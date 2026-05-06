// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MyContract
/// @notice Minimal example contract for Ritual Testnet deployment.
contract MyContract {
    string public message;

    constructor(string memory initialMessage) {
        message = initialMessage;
    }

    function setMessage(string calldata newMessage) external {
        message = newMessage;
    }
}

