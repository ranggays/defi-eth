// SPDX-License-Identifier:MIT
pragma solidity >=0.8.0 <0.9.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20{
    event FaucetUsed(address indexed user, uint256 amount);

    constructor() ERC20("Mock USD", "mUSD"){
        // Mint 1 Juta token ke pembuat contract (opsional)
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }

    // Fitur Faucet Public
    // Siapapun bisa panggil fungsi ini untuk dapat 1.000 token gratis
    function faucet() external{
        uint256 amount = 1000 * 10 ** decimals();
        _mint(msg.sender, amount);
        emit FaucetUsed(msg.sender, amount);
    }
}