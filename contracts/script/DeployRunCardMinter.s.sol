// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/RitualRunCardMinter.sol";

contract DeployRunCardMinter is Script {
    function run() external returns (RitualRunCardMinter deployed) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.envAddress("MINT_OWNER");
        uint256 mintFeeWei = vm.envOr("MINT_FEE_WEI", uint256(0));

        vm.startBroadcast(deployerPrivateKey);
        deployed = new RitualRunCardMinter(owner, mintFeeWei);
        vm.stopBroadcast();
    }
}

