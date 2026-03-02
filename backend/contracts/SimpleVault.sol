// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SimpleVault is ReentrancyGuard {
    IERC20 public immutable token;
    mapping(address => uint256) public balances;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    constructor(address _tokenAddress){
        token = IERC20(_tokenAddress);
    }

    function deposit(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        // User harus sudah APPROVE contract ini sebelumnya
        bool success = token.transferFrom(msg.sender, address(this), _amount);
        require(success, "Transfer failed");

        balances[msg.sender] += _amount;
        emit Deposit(msg.sender, _amount);
    }

    function withdraw(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(balances[msg.sender] >= _amount, "Insufficient balance");

        balances[msg.sender] -= _amount;
        bool success = token.transfer(msg.sender, _amount);
        require(success, "Transfer failed");
        emit Withdraw(msg.sender, _amount);
    }
}