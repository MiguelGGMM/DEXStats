require('dotenv').config();
const { default: BigNumber } = require("bignumber.js");
const BN = require("bn.js");

const ZERO_ADDRESS = `0x0000000000000000000000000000000000000000`;
const DEAD_ADDRESS = `0x000000000000000000000000000000000000dEaD`;

const IERC20Metadata = artifacts.require("IERC20Metadata");
const IDEXRouter = artifacts.require("IDEXRouter");
const TEMPLATE = artifacts.require("Template");
const DEXSTATS = artifacts.require("DEXStats");
const IPAIRDATAFEED = artifacts.require("IPairDatafeed");

const BN2 = x => new BN(x);

const defaultGwei = new BN(5000000000);
const defaultGweiTestnet = new BN(10000000000);
const debug = true;

const multiTest = true;
const nAcountsPerType = 10;

//const moment = require('moment');

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */

/*
*   Util functions
*/
const getGasAmount = async (txHash) => {
    const tx = await web3.eth.getTransaction(txHash);
    const receipt = await web3.eth.getTransactionReceipt(txHash);
    const gasPrice = tx.gasPrice;
    const gasUsed = receipt.gasUsed;

    return web3.utils.fromWei(gasPrice, 'ether') * gasUsed;
}

const getContractBalance = async (contract) => {
    const balance = await contract.getBalance();
    return web3.utils.fromWei(balance, 'ether');
}

const getAccountBalance = async (account) => {
    let balance = await web3.eth.getBalance(account);
    return web3.utils.fromWei(balance, 'ether');
}

const toWei = (value) => web3.utils.toWei(value.toString());
const fromWei = (value, fixed=2) => parseFloat(web3.utils.fromWei(value)).toFixed(fixed);

const increaseDays = async (days) => {
    await increase(86400 * parseInt(days));
}

const increase = async (duration) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [duration],
            id: new Date().getTime()
        }, (err, result) => {
            // second call within the callback
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_mine',
                params: [],
                id: new Date().getTime()
            }, (err, result) => {
                // need to resolve the Promise in the second callback
                resolve();
            });
        });
    });
}

const log = (message) => {
    if(debug){
        console.log(`[DEBUG] ${message}`);
    }
}

contract("Template", function (accounts) {

    /*
    *   Template tests
    */

    var initialMcap = 0;

    var ctrTK = null;
    var ctrPAIR = null;
    var ctrDEX = null;
    var ctrDEXsts = null;
    var ctrPairDF = null;
    var main_account = accounts[0];

    const checkMcapVSDatafeed = async () => {
        let token_bal = await ctrTK.balanceOf(main_account);
        let bal = await getAccountBalance(main_account);
        let currMarketcap = parseInt((await ctrDEXsts.getTOKENdilutedMarketcap(6)));
        // Mcap taking price from chainlink datafeed
        let wethPriceChainlinkDF = await ctrPairDF.latestAnswer();
        let pairReserves = await ctrDEXsts.getReservesPairToken();
        let pairDecs = await ctrPAIR.decimals();
        let totalSupply = await ctrTK.totalSupply();
        let datafeedDecimals = await ctrPairDF.decimals();        
        let pairAmount = BN2(pairReserves[0].toString()).mul(BN2("1000")).div(BN2((10 ** parseInt(pairDecs.toString())).toString()));
        let marketcapPDF = wethPriceChainlinkDF.mul(totalSupply).div(pairReserves[1]).mul(pairAmount).div(BN2("1000"));            
        marketcapPDF = parseInt(parseInt(marketcapPDF.toString()) / (10 ** parseInt(datafeedDecimals.toString())));
        log(`Acc. ETH balance ${bal}, acc. Token balance ${token_bal}, initial mcap ${initialMcap}, token marketcap ${currMarketcap}$, token marketcap chainlink ${marketcapPDF}$`);            
        return [currMarketcap < marketcapPDF * 1.01 && currMarketcap > marketcapPDF * 0.99, currMarketcap];
    }

    const addLiqDEX = async (_eth, _nTokens) => {
        log(`Approving tokens ${_nTokens}`);
        await ctrTK.approve(ctrDEX.address, _nTokens);
        log(`Adding liq. ${_eth.toString()} (ETH), ${_nTokens.toString()} (TOKENS)`);
        await ctrDEX.addLiquidityETH( 
            ctrTK.address,
            _nTokens,
            _nTokens,
            toWei(1),
            main_account,
            parseInt(Date.now()/1000) + 3600,                     
        {
            value: toWei(_eth),
            //from: main_account,
            gas: "2000000"
        });
        log('Liq. added');
    }

    const buyDEX = async (_eth) => {
        log(`Buying ${_eth} ETH...`);
        await ctrDEX.swapExactETHForTokensSupportingFeeOnTransferTokens(
            0,
            [(await ctrDEX.WETH()), ctrTK.address],
            main_account,
            parseInt(Date.now()/1000) + 3600, 
            {
                value: toWei(_eth),
                from: main_account,
                gas: "2000000"                
            });
        log(`Buy performed, ${_eth} ETH`);
    }

    const sellDEX = async (_nTokens) => {
        log(`Approving tokens ${_nTokens}`);
        await ctrTK.approve(ctrDEX.address, _nTokens);
        log(`Selling... ${_nTokens.toString()} tokens`);
        await ctrDEX.swapExactTokensForETHSupportingFeeOnTransferTokens(
            _nTokens.toString(),
            0,
            [ctrTK.address, (await ctrDEX.WETH())],
            main_account,
            parseInt(Date.now()/1000) + 3600, 
            {
                //value: toWei("0.05"),
                from: main_account,
                gas: "2000000"                
            });
        log(`Sell performed: ${_nTokens.toString()} tokens`);
    }

    it("Should fail if a contract is not deployed", async function(){

        try {

            ctrTK = await TEMPLATE.deployed();
            ctrPAIR = await IERC20Metadata.at(process.env.PAIR);
            ctrDEX = await IDEXRouter.at(process.env.ROUTER);
            ctrDEXsts = await DEXSTATS.at((await ctrTK.getDEXStatsAddress()));
            ctrPairDF = await IPAIRDATAFEED.at(process.env.PAIR_DATAFEED);

            log(`Contracts deployed: Token template, Token pair, DEX stats, DEX router, Chainlink pair datafeed`);
            log(`Addresses: ${ctrTK.address}, ${ctrPAIR.address}, ${ctrDEXsts.address}, ${ctrDEX.address}, ${ctrPairDF.address}`);

            return assert.isTrue(true);
        } catch (err) {
            console.log(err.toString());
            return assert.isTrue(false);
        }
    });

    it('Add liq and check data', async function(){
        try
        {
            // Check data ini
            // await checkMcapVSDatafeed();    

            // Add liq. 0.5M tokens - 1 ETH
            let token_bal = await ctrTK.balanceOf(main_account);
            await addLiqDEX("1", token_bal.div(BN2(2)));

            // Check init
            assert.isTrue((await ctrTK.initialized()) == true);

            // Check data           
            token_bal = await ctrTK.balanceOf(main_account);
            let result = await checkMcapVSDatafeed();

            // Store initial mcap
            initialMcap = await ctrTK.initialMcap();

            return assert.isTrue(result[0]);
        } catch (err) {
            console.log(err.toString());
            return assert.isTrue(false);
        }
    });
    
    it('Perform buy', async function(){
        try
        {
            // Check data ini
            await checkMcapVSDatafeed();    

            // Perform buy
            await buyDEX("0.02");

            // Check data
            let result = await checkMcapVSDatafeed();    

            return assert.isTrue(result[0]);
        } catch (err) {
            console.log(err.toString());
            return assert.isTrue(false);
        }
    });

    it('Perform sell should work', async function(){
        try
        {
            // Check data ini
            await checkMcapVSDatafeed();    
        
            // Perform sell
            let tokensSell = await ctrTK.balanceOf(main_account);
            await sellDEX(tokensSell.div(BN2(2)).toString());

            // Check data
            result = await checkMcapVSDatafeed();    
            currMarketcap = result[1];

            return assert.isTrue(result[0]);
        } catch (err) {
            console.log(err.toString());
            return assert.isTrue(false);
        }
    });

    it('Perform small sell should not work', async function(){
        let isOk = true;

        try
        {
            // Check data ini
            await checkMcapVSDatafeed();    
                 
            // Perform sell
            let tokensSell = await ctrTK.balanceOf(main_account);
            await sellDEX(tokensSell.div(BN2(20)).toString());

            // Check data fin
            result = await checkMcapVSDatafeed();    
            currMarketcap = result[1];

            isOk = false;
            return assert.isTrue(false);
        } catch (err) {
            if(isOk){
                console.log(`[OK] ${err.toString()}`);            
                return assert.isTrue(true);
            }else {
                return assert.isTrue(false);
            }
        }
    });

    it('Perform buy 2', async function(){
        try
        {
            // Check data ini
            await checkMcapVSDatafeed();    

            // Perform buy
            await buyDEX("0.02");

            // Check data
            let result = await checkMcapVSDatafeed();    

            return assert.isTrue(result[0]);
        } catch (err) {
            console.log(err.toString());
            return assert.isTrue(false);
        }
    });
});