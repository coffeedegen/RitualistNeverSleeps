// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Ritual Run Card Minter
/// @notice Minimal mint contract used by the game client to mint run-card payloads onchain.
contract RitualRunCardMinter {
    event RunCardMinted(
        uint256 indexed tokenId,
        address indexed minter,
        string payload
    );

    uint256 public nextTokenId = 1;
    address public owner;
    uint256 public mintFeeWei;

    mapping(uint256 => address) public tokenOwner;
    mapping(uint256 => string) public tokenPayload;

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor(address owner_, uint256 mintFeeWei_) {
        require(owner_ != address(0), "OWNER_ZERO");
        owner = owner_;
        mintFeeWei = mintFeeWei_;
    }

    /// @notice Mint function signature expected by the frontend (`mintRunCard(string)`).
    function mintRunCard(string calldata payload) external payable returns (uint256 tokenId) {
        require(bytes(payload).length > 0, "EMPTY_PAYLOAD");
        require(msg.value >= mintFeeWei, "INSUFFICIENT_MINT_FEE");

        tokenId = nextTokenId;
        unchecked {
            nextTokenId = tokenId + 1;
        }

        tokenOwner[tokenId] = msg.sender;
        tokenPayload[tokenId] = payload;
        emit RunCardMinted(tokenId, msg.sender, payload);
    }

    function setMintFeeWei(uint256 newFeeWei) external onlyOwner {
        mintFeeWei = newFeeWei;
    }

    function setOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "OWNER_ZERO");
        owner = newOwner;
    }

    function withdraw(address payable to, uint256 amountWei) external onlyOwner {
        require(to != address(0), "TO_ZERO");
        require(address(this).balance >= amountWei, "BALANCE_LOW");
        (bool ok, ) = to.call{value: amountWei}("");
        require(ok, "WITHDRAW_FAILED");
    }
}

