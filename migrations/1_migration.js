try{
  require('dotenv').config({path: "../.env"});
  const _ = require('lodash');
  console.log('Migrating');
  const TEMPLATE = artifacts.require("Template");

  module.exports = function(deployer) {
    console.log(
      `Deploying using parameters: \n\t${_.filter(Object.keys(process.env), (_o) => 
        ["NAME", "SYMBOL", "PAIR", "STABLE", "ROUTER"].includes(_o)).map(_o => `${_o}:${process.env[_o]}\n\t`)}`
    );
    return deployer.deploy(TEMPLATE, process.env.NAME, process.env.SYMBOL, process.env.PAIR, process.env.STABLE, process.env.ROUTER);
  };

}catch(err){
  console.log(err.toString());
}