const chalk = require('chalk');


var markets = [];
var boughtCurrencies = [];
var marketFilters = {};

const APIKEY = 'h7RZD9RMsqPd8JQeVX1R0zdzx7l6K5gAaABbtBkvsdSo1GpiFiSZDJuRuee49Q2q';
const APISECRET = 'Fj01NaKU697e949f4IzpBlDhzoIWqWEnfVrtaRTbgoctRVsAhkBYoAVt2XCdg0PK';


const binance = require('node-binance-api')().options({
    APIKEY: APIKEY,
    APISECRET: APISECRET,
    useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
    recvWindow: 100000
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

binance.balance(function (error, data) {
    console.log(chalk.yellow('\n', new Date().toUTCString(), 'YOUR CURRENT', tradeRules.currency, "BALANCE IS:"));
    console.log(chalk.yellow(JSON.stringify(data[tradeRules.currency]), '\n'));
    boughtCurrencies[tradeRules.currency] = data[tradeRules.currency].available;
});

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
