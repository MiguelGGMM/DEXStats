# DEXStats
 Example of a token rid of priviledges that can check his own price and marketcap against DEX\
 (using DEXStats contract) in order to take decisions

 ## How to run
 First install ganache and truffle globally using
 ```
 $ npm install ganache -g
 ```
 ```
 $ npm install truffle -g
 ```
 \
 Then install the local libraries
 ```
 $ npm install
 ```

Compile the contracts
```
$ npm run compile
```
Run ganache on another terminal
```
$ npm run ganacheFork
```
Run the tests
```
$ npm run test
```

## How to deploy
1-Edit token template and test it\
2-Set your pk on .pk file\
3-Run the migration command
```
$ npm run deploy
```
\
Edit the deploy command on package.json to choose another network or truffle-config.js if you want to add more networks
 


