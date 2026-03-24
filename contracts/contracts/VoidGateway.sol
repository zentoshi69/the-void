// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract VoidGateway is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    mapping(address => bool) public isValidator;
    address[] public validators;
    uint256 public threshold;

    mapping(address => bool) public supportedTokens;
    mapping(bytes32 => bool) public pendingIntents;
    mapping(bytes32 => bool) public usedNullifiers;
    mapping(bytes32 => bool) public settledCommitments;
    mapping(address => uint256) public lockedBalance;

    uint256 public batchNonce;
    uint256 public constant MIN_THRESHOLD = 2;
    uint256 public constant MAX_BATCH_SIZE = 100;
    uint256 public constant INTENT_TTL = 7 days;

    struct IntentMeta {
        address depositor;
        address token;
        uint256 amount;
        uint256 sealedAt;
    }
    mapping(bytes32 => IntentMeta) public intentMeta;

    event IntentSealed(
        bytes32 indexed commitmentHash,
        address indexed token,
        uint256 indexed targetChainId,
        uint64 batchWindow
    );

    event IntentCancelled(
        bytes32 indexed commitmentHash,
        address indexed depositor,
        address indexed token
    );

    event BatchSettled(
        uint256 indexed batchId,
        bytes32 indexed proofHash,
        uint256 settledCount,
        uint256 timestamp
    );

    event Released(
        bytes32 indexed nullifier,
        address indexed recipient,
        address indexed token
    );

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event TokenSupported(address indexed token, bool supported);
    event ThresholdUpdated(uint256 newThreshold);

    constructor(address[] memory _validators, uint256 _threshold)
        Ownable(msg.sender)
    {
        require(_validators.length >= MIN_THRESHOLD, "Too few validators");
        require(
            _threshold >= MIN_THRESHOLD && _threshold <= _validators.length,
            "Bad threshold"
        );
        for (uint256 i = 0; i < _validators.length; i++) {
            require(
                _validators[i] != address(0) && !isValidator[_validators[i]],
                "Bad validator"
            );
            isValidator[_validators[i]] = true;
            validators.push(_validators[i]);
        }
        threshold = _threshold;
    }

    function sealIntent(
        bytes32 commitmentHash,
        address token,
        uint256 amount,
        uint256 targetChainId,
        uint64 batchWindow
    ) external payable nonReentrant whenNotPaused {
        require(!pendingIntents[commitmentHash], "Already sealed");
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Zero amount");
        require(targetChainId != block.chainid, "Same chain");

        if (token == address(0)) {
            require(msg.value == amount, "Bad native amount");
        } else {
            require(msg.value == 0, "Native with ERC20");
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        pendingIntents[commitmentHash] = true;
        lockedBalance[token] += amount;
        intentMeta[commitmentHash] = IntentMeta({
            depositor: msg.sender,
            token: token,
            amount: amount,
            sealedAt: block.timestamp
        });

        emit IntentSealed(commitmentHash, token, targetChainId, batchWindow);
    }

    function settleBatch(
        bytes32 proofHash,
        bytes32[] calldata commitments,
        bytes32[] calldata nullifiers,
        address[] calldata recipients,
        address[] calldata tokens,
        uint256[] calldata amounts,
        address[] calldata signers,
        bytes[] calldata signatures
    ) external nonReentrant whenNotPaused {
        uint256 n = nullifiers.length;
        require(n > 0 && n <= MAX_BATCH_SIZE, "Bad batch size");
        require(
            n == commitments.length &&
            n == recipients.length &&
            n == tokens.length &&
            n == amounts.length,
            "Length mismatch"
        );
        require(
            signers.length >= threshold && signers.length == signatures.length,
            "Bad signers"
        );

        _verifyThreshold(proofHash, signers, signatures);

        uint256 batchId = ++batchNonce;
        for (uint256 i = 0; i < n; i++) {
            bytes32 nullifier = nullifiers[i];
            require(!usedNullifiers[nullifier], "Nullifier replayed");
            usedNullifiers[nullifier] = true;

            bytes32 commitment = commitments[i];
            require(pendingIntents[commitment], "Intent not pending");
            pendingIntents[commitment] = false;
            settledCommitments[commitment] = true;
            delete intentMeta[commitment];

            address token = tokens[i];
            uint256 amount = amounts[i];
            require(amount > 0, "Zero release amount");
            require(lockedBalance[token] >= amount, "Insufficient locked");
            lockedBalance[token] -= amount;

            if (token == address(0)) {
                (bool ok, ) = recipients[i].call{value: amount, gas: 30000}("");
                require(ok, "Native transfer failed");
            } else {
                IERC20(token).safeTransfer(recipients[i], amount);
            }

            emit Released(nullifier, recipients[i], token);
        }

        emit BatchSettled(batchId, proofHash, n, block.timestamp);
    }

    function cancelIntent(
        bytes32 commitmentHash,
        address token,
        uint256 amount,
        uint256 targetChainId,
        bytes32 recipientHash,
        bytes32 salt
    ) external nonReentrant whenNotPaused {
        require(pendingIntents[commitmentHash], "Not found");

        bytes32 derived = keccak256(
            abi.encode(msg.sender, token, amount, targetChainId, recipientHash, salt)
        );
        require(derived == commitmentHash, "Commitment mismatch");

        IntentMeta memory meta = intentMeta[commitmentHash];
        require(meta.depositor == msg.sender, "Not depositor");
        require(meta.token == token, "Token mismatch");
        require(meta.amount == amount, "Amount mismatch");

        pendingIntents[commitmentHash] = false;
        lockedBalance[token] -= amount;
        delete intentMeta[commitmentHash];

        if (token == address(0)) {
            (bool ok, ) = msg.sender.call{value: amount, gas: 30000}("");
            require(ok, "Refund failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }

        emit IntentCancelled(commitmentHash, msg.sender, token);
    }

    function rescueExpiredIntent(bytes32 commitmentHash) external nonReentrant {
        require(pendingIntents[commitmentHash], "Not found");
        IntentMeta memory meta = intentMeta[commitmentHash];
        require(meta.depositor == msg.sender, "Not depositor");
        require(block.timestamp >= meta.sealedAt + INTENT_TTL, "Not expired");

        pendingIntents[commitmentHash] = false;
        lockedBalance[meta.token] -= meta.amount;
        delete intentMeta[commitmentHash];

        if (meta.token == address(0)) {
            (bool ok, ) = msg.sender.call{value: meta.amount, gas: 30000}("");
            require(ok, "Rescue failed");
        } else {
            IERC20(meta.token).safeTransfer(msg.sender, meta.amount);
        }

        emit IntentCancelled(commitmentHash, msg.sender, meta.token);
    }

    function _verifyThreshold(
        bytes32 proofHash,
        address[] calldata signers,
        bytes[] calldata signatures
    ) internal view {
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", proofHash)
        );
        address last = address(0);
        uint256 valid;
        for (uint256 i = 0; i < signers.length; i++) {
            require(signers[i] > last, "Not sorted");
            require(isValidator[signers[i]], "Not validator");
            last = signers[i];
            (address recovered, bool ok) = _tryRecover(ethHash, signatures[i]);
            require(ok && recovered == signers[i], "Bad sig");
            valid++;
        }
        require(valid >= threshold, "Threshold not met");
    }

    function _tryRecover(
        bytes32 hash,
        bytes calldata sig
    ) internal pure returns (address, bool) {
        if (sig.length != 65) return (address(0), false);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return (address(0), false);

        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return (address(0), false);
        }

        address recovered = ecrecover(hash, v, r, s);
        if (recovered == address(0)) return (address(0), false);
        return (recovered, true);
    }

    function addValidator(address v) external onlyOwner {
        require(!isValidator[v] && v != address(0), "Invalid");
        isValidator[v] = true;
        validators.push(v);
        emit ValidatorAdded(v);
    }

    function removeValidator(address v) external onlyOwner {
        require(isValidator[v], "Not validator");
        isValidator[v] = false;

        uint256 len = validators.length;
        for (uint256 i = 0; i < len; i++) {
            if (validators[i] == v) {
                validators[i] = validators[len - 1];
                validators.pop();
                break;
            }
        }

        require(validators.length >= threshold, "Below threshold");
        emit ValidatorRemoved(v);
    }

    function setThreshold(uint256 t) external onlyOwner {
        require(
            t >= MIN_THRESHOLD && t <= validators.length,
            "Bad threshold"
        );
        threshold = t;
        emit ThresholdUpdated(t);
    }

    function setSupportedToken(
        address token,
        bool supported
    ) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function validatorCount() external view returns (uint256) {
        return validators.length;
    }
}
