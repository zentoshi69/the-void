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
    mapping(address => uint256) public lockedBalance;

    uint256 public batchNonce;
    uint256 public constant MIN_THRESHOLD = 2;
    uint256 public constant MAX_BATCH_SIZE = 100;

    event IntentSealed(
        bytes32 indexed commitmentHash,
        address indexed token,
        uint256 indexed targetChainId,
        uint64 batchWindow
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
        require(_threshold >= MIN_THRESHOLD && _threshold <= _validators.length, "Bad threshold");
        for (uint i = 0; i < _validators.length; i++) {
            require(_validators[i] != address(0) && !isValidator[_validators[i]], "Bad validator");
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

        emit IntentSealed(commitmentHash, token, targetChainId, batchWindow);
    }

    function settleBatch(
        bytes32 proofHash,
        bytes32[] calldata nullifiers,
        address[] calldata recipients,
        address[] calldata tokens,
        uint256[] calldata amounts,
        address[] calldata signers,
        bytes[] calldata signatures
    ) external nonReentrant whenNotPaused {
        uint256 n = nullifiers.length;
        require(n > 0 && n <= MAX_BATCH_SIZE, "Bad batch size");
        require(n == recipients.length && n == tokens.length && n == amounts.length, "Length mismatch");
        require(signers.length >= threshold && signers.length == signatures.length, "Bad signers");

        _verifyThreshold(proofHash, signers, signatures);

        uint256 batchId = ++batchNonce;
        for (uint256 i = 0; i < n; i++) {
            bytes32 nullifier = nullifiers[i];
            require(!usedNullifiers[nullifier], "Nullifier replayed");
            usedNullifiers[nullifier] = true;

            address token = tokens[i];
            uint256 amount = amounts[i];
            require(lockedBalance[token] >= amount, "Insufficient locked");
            lockedBalance[token] -= amount;

            if (token == address(0)) {
                (bool ok,) = recipients[i].call{value: amount}("");
                require(ok, "Native transfer failed");
            } else {
                IERC20(token).safeTransfer(recipients[i], amount);
            }

            emit Released(nullifier, recipients[i], token);
        }

        emit BatchSettled(batchId, proofHash, n, block.timestamp);
    }

    function cancelIntent(
        address token,
        uint256 amount,
        uint256 targetChainId,
        bytes32 recipientHash,
        bytes32 salt
    ) external nonReentrant {
        bytes32 commitment = keccak256(
            abi.encodePacked(msg.sender, token, amount, targetChainId, recipientHash, salt)
        );
        require(pendingIntents[commitment], "Not found");
        pendingIntents[commitment] = false;
        lockedBalance[token] -= amount;

        if (token == address(0)) {
            (bool ok,) = msg.sender.call{value: amount}("");
            require(ok, "Refund failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
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
            require(_recover(ethHash, signatures[i]) == signers[i], "Bad sig");
            valid++;
        }
        require(valid >= threshold, "Threshold not met");
    }

    function _recover(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Bad sig length");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        return ecrecover(hash, v, r, s);
    }

    function addValidator(address v) external onlyOwner {
        require(!isValidator[v] && v != address(0), "Invalid");
        isValidator[v] = true;
        validators.push(v);
        emit ValidatorAdded(v);
    }

    function setThreshold(uint256 t) external onlyOwner {
        require(t >= MIN_THRESHOLD && t <= validators.length, "Bad threshold");
        threshold = t;
        emit ThresholdUpdated(t);
    }

    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function validatorCount() external view returns (uint256) { return validators.length; }
    receive() external payable {}
}
