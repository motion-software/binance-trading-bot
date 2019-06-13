## **A crypto trading bot … everybody thinks that creating one is a complicated task. But is it?** 

Let’s think about what we need to make such a bot. The backbone of a trading bot is the trading algorithm (or trading strategy). We also need communication through a trading platform and most of them have exposed their own APIs so we can use them. The last thing that we need is a programming platform (.NET, Java, JavaScript would do).

## **Trading strategy:**

This is the most complex part of the task. There are a lot of trading strategies some with short term and others with long term profits. So, which should we choose? In order to use the bot for all our needs we can’t stick to one trading strategy, instead we need to implement as many as we can, so we can use a variety of strategies for different currencies/markets. Most of the strategies are well described and we just need to implement them, but still it’s a time consuming job and we have to do it step by step starting with one and then implementing more as we go along.

## **Integration with exchanges**

There are a lot of exchanges centralized/decentralized most of them have exposed their API. For our first version we will use [Binance API](https://github.com/binance-exchange/binance-official-api-docs/blob/master/rest-api.md). Working with one exchange is easy. We will have problems when we integrate with more exchanges in the future because different APIs have different functionality, they could:

1.  Provide the same data set in a different format
2.  Requests for data may be different
3.  They may not provide that data at all

## **Programming platform:**

As mentioned before there are lots of programming languages and platforms. But since we want to reach more people with this article we will use JavaScript. Most of the developers worldwide know JavaScript and it will be easy for them to understand.

## **Let’s start building our crypto trading bot**

![](http://motion-software.com/blog/wp-content/uploads/2019/06/38056454431_706e1e5a68_k-1-800x533.jpg)

## **Environment Setup**

First we need to setup our environment and since this is not the main purpose of this article here is a link with guidance on [how to setup NodeJS environment](http://dreamerslab.com/blog/en/how-to-setup-a-node-js-development-environment-on-windows/).

For IDE I’m going to use [Webstorm](https://www.jetbrains.com/webstorm/) (Because I like it) but you can choose whatever you want.

## **Project setup**

We are going to start by creating a new folder for the project, initialize a new application and install all necessary dependencies we need for now.

After making a new folder on your local machine, start a command prompt in it and initialize a new npm project by typing `npm init`

Then we proceed by installing all necessary dependencies:

npm install --save node-binance-api
npm install --save chalk

[Node Binance Api](https://github.com/jaggedsoft/node-binance-api) – We are going to use it for communication with Binance API

[Chalk](https://github.com/chalk/chalk) – We are going to use chalk to write data on the console in a more understandable way by visualizing it in different colors.

Now that we have all dependencies installed. We can start coding:

In our main JS file, we need to import all dependencies and configurations:

    const chalk = require('chalk');
    var markets = [];
    var boughtCurrencies = [];
    var marketFilters = {};
    
    const APIKEY = ‘your-api-key’;
    const APISECRET = ‘Your api secret’;
    
    const binance = require('node-binance-api')().options({
     APIKEY: APIKEY,
     APISECRET: APISECRET,
     useServerTime: true // If you get timestamp errors, synchronize to server time at startup
    });
    
    // ALGORITHM RULES CONFIGURATIONS
    var tradeRules = {
     ratio: 0.01,
     quantity: 0.0005,
     currency: 'BTT',
     buyPremium: 1.0005,
     sellTarget: 1.02,
     buyTarget: 0.98
    }

We have imported and configured our binance client with the API key and API secret provided by the Binance platform from your account. We need some trade rules to be followed by our application to start trading. The above trade rules are just for demonstration and one can change them depending on your professional preferences.

## **Implementing a trading strategy and Binance integration:**

As mentioned before there are a lot of strategies but for now we will implement a simple one. This is something like a test strategy, so we can get familiarized with Binance API and its capabilities. After that we are going to start implementing more complicated strategies for our bot.

For our test strategy we are going to gather the chart data from Binance API and calculate the average price, if it is lower than current we are going to sell otherwise we are going to buy. Before actual implementation we need to know how much money there is in this account, we will call the Binance API and get the balance for the account.

    binance.balance(function (error, data) {
     console.log(chalk.yellow('\n', new Date().toUTCString(), 'YOUR CURRENT', tradeRules.currency, "BALANCE IS:"));
     console.log(chalk.yellow(JSON.stringify(data[tradeRules.currency]), '\n'));
     boughtCurrencies[tradeRules.currency] = data[tradeRules.currency].available;
    });

After we know the balance we need to get the markets in which we can trade. Then we will subscribe for char price updates, and we will implement our strategy. When the buy/sell conditions are met we will send buy/sell orders to the exchange. Right after they are executed we are going to create a new order with the opposite action and a profitable price.

        binance.exchangeInfo(function (error, data) {
        data.symbols.forEach(function (symbol) {
            if (symbol.baseAsset == tradeRules.currency || symbol.quoteAsset == tradeRules.currency) {
                marketFilters[symbol.symbol] = symbol.filters;
                markets.push(symbol.symbol);
            }
        });
        console.log(markets);
        binance.websockets.chart(markets, "1m", function (symbol, interval, chart) {
            let arr = Object.values(chart).map(a => a.low).sort();
            let sum = Object.values(chart).map(a => a.low).reduce(function (a, b) {
                return Number(a) + Number(b);
            });
            let average = sum / Object.values(chart).length;
            if (symbol.startsWith(tradeRules.currency)) {
                if (arr[arr.length - 1] * tradeRules.sellTarget > average) {
                    console.log(chalk.green(new Date().toUTCString(), `Sell ${symbol}  ${arr[arr.length - 1]} price`));
                    let quantity = (boughtCurrencies[tradeRules.currency] * tradeRules.quantity).toFixed();
                    let price = arr[arr.length - 1];
                    let filtersForMarket = marketFilters[symbol];
                    let result = filter(filtersForMarket, quantity, price);
                    quantity = result.quantity;
                    price = result.price;
                    binance.sell(symbol, quantity, price, {type: "LIMIT"}, (error, response) => {
                        if (!error) {
                            console.log(chalk.green(new Date().toUTCString(), "Order Id", response.orderId));
                            boughtCurrencies[tradeRules.currency] -= response.executedQty;
                            let buyPrice = arr[arr.length - 1] * tradeRules.buyTarget;
                            let buyQuantity = (Number(response.executedQty) * Number(response.price)) / buyPrice;
                            let result = filter(filtersForMarket, buyQuantity, buyPrice);
                            buyQuantity = result.quantity;
                            buyPrice = result.price;
                            binance.buy(symbol, buyQuantity, buyPrice, {}, (error, response) => {
                                if (!error) {
                                    boughtCurrencies[tradeRules.currency] += response.executedQty;
                                }
                            });
                        }
                    });
                }
            } else {
                if (arr[arr.length - 1] < average) {
                    console.log(chalk.green(new Date().toUTCString(), `Buy ${symbol}  ${arr[arr.length - 1].low} price`));
                    let quantity = (tradeRules.quantity).toFixed();
                    let price = arr[arr.length - 1];
                    let result = filter(filtersForMarket, quantity, price);
                    quantity = result.quantity;
                    price = result.price;
    
                    binance.buy(symbol, quantity, arr[arr.length - 1], {type: 'LIMIT'}, (error, response) => {
                        if (!error) {
                            console.log(chalk.green(new Date().toUTCString(), "Order Id", response.orderId));
                            boughtCurrencies[tradeRules.currency] -= response.executedQty;
                            let sellPrice = arr[arr.length - 1] * tradeRules.sellTarget;
                            let sellQuantity = quantity;
                            binance.sell(symbol, sellQuantity, sellPrice, {type: 'LIMIT'}, (erorr, response) => {
                                boughtCurrencies[tradeRules.currency] += response.executedQty;
                            });
                        }
                    });
                }
            }
        });
    });
    
    function filter(filtersForMarket, quantity, price) {
        for (let filter of filtersForMarket) {
            if (filter.filterType == "LOT_SIZE") {
                if (Number(filter.minQty) > quantity) {
                    quantity = filter.minQty;
                }
                if (Number(filter.maxQty) < quantity) {
                    quantity = filter.maxQty;
                }
            }
            if (filter.filterType == "MIN_NOTIONAL") {
                if (Number(filter.minNotional) > quantity * price) {
                    quantity = Math.ceil((Number(filter.minNotional) / price));
                }
            }
        }
        return {quantity, price};
    }

This is the implementation of the logic mentioned before. It’s not very pretty but this is a start.

## **Conclusion**

This tutorial is just the beginning, there is a lot of work in order to create a working trading bot. We are going to proceed with the development of our application in order to make it more sophisticated, organized and productive. We are going to start gathering market data for future analysis to elaborate a better algorithm for trading.

Trying to answer the question we posed in the beginning of this post, it is complicated to build a crypto trading bot, yes, but it is not impossible.

 [**Blog post link**](http://motion-software.com/blog/crypto-trading-bot-tutorial-javascript/)


