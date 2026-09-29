// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PermissionToken} from "../src/PermissionToken.sol";
import {AgentWallet} from "../src/AgentWallet.sol";

/// @notice Deploys PermissionToken + AgentWallet to whatever chain --rpc-url points at (Anvil for
///         local demo), funds AgentWallet with test ETH, and writes the resulting addresses to
///         deployments.json so the mock-agent/killswitch/dashboard scripts can all pick them up
///         without hardcoding anything.
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        PermissionToken permissionToken = new PermissionToken();
        AgentWallet agentWallet = new AgentWallet(address(permissionToken));

        // Fund the AgentWallet so execute() can forward ETH value in demo transactions.
        (bool ok,) = address(agentWallet).call{value: 0.005 ether}("");
        require(ok, "funding AgentWallet failed");

        vm.stopBroadcast();

        console.log("Deployer (Cold):     ", deployer);
        console.log("PermissionToken:     ", address(permissionToken));
        console.log("AgentWallet:         ", address(agentWallet));

        string memory json = string.concat(
            "{\n",
            '  "permissionToken": "', vm.toString(address(permissionToken)), '",\n',
            '  "agentWallet": "', vm.toString(address(agentWallet)), '",\n',
            '  "deployer": "', vm.toString(deployer), '"\n',
            "}\n"
        );
        vm.writeFile("deployments.json", json);
    }
}
