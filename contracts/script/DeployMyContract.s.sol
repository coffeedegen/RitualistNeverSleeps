// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MyContract.sol";

contract DeployMyContract is Script {
    function run() external returns (MyContract deployed) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory initialMessage = vm.envOr("INITIAL_MESSAGE", string("Hello Ritual"));

        vm.startBroadcast(deployerPrivateKey);
        deployed = new MyContract(initialMessage);
        vm.stopBroadcast();
    }
}

