// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MutantAccounting} from "../src/MutantAccounting.sol";

contract MutantAccountingScript is Script {
    function run() public {
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        MutantAccounting accounting = new MutantAccounting(treasury);

        vm.stopBroadcast();

        console.log("MutantAccounting deployed to:", address(accounting));
        console.log("Owner (deployer):", msg.sender);
    }
}
