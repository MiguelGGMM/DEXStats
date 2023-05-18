// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../openzeppelin-contracts/access/Ownable.sol';
import '../openzeppelin-contracts/token/ERC20/ERC20.sol';
import './DEXStats.sol';
import '../Libraries/IDEXRouter.sol';
import '../Libraries/IFactory.sol';

/**
 * @dev Example of contract that uses DEXStats.sol
 * users can not sell once marketcap falls below initial
 */

contract Template is ERC20 {

    DEXStats dexStats;
    address public liqPair;        
    uint256 public initialMcap;
    bool public initialized;

    // After creation
    modifier initializeDEXStats {
        if(!initialized && address(this).code.length > 0 && !dexStats.initialized()){
            dexStats.initializeDEXStats(decimals());  
            initialized = true;
        }
        _;
    }

    constructor (
        string memory name_, 
        string memory symbol_, 
        address pair_, 
        address stable_, 
        address router_) 
        ERC20(name_, symbol_) {
            _mint(msg.sender, 1_000_000 * (10 ** decimals())); //1M supply
            liqPair = IFactory(IDEXRouter(router_).factory()).createPair(pair_, address(this));
            dexStats = new DEXStats(address(this), pair_, stable_, IDEXRouter(router_).factory(), 6);          
    }

    function getDEXStatsAddress() public view returns (address) { return address(dexStats); }

    function safeGetMarketcap() private view returns (uint256, bool) {
        try dexStats.getTOKENdilutedMarketcap(6) returns(uint256 _mcap) { 
            return(_mcap, true);
        } catch { 
            return(0, false);
        }
    }

    function _afterTokenTransfer(address, address to, uint256) initializeDEXStats internal override {
        if(address(dexStats) != address(0)){
            (uint256 mcap, bool isValid) = safeGetMarketcap();
            if(initialMcap == 0){
                initialMcap = mcap;
            }
            require(to != liqPair || !isValid || initialMcap == 0 || mcap >= initialMcap, "You can not sell once Marketcap falls below initial");
        }
    }
}