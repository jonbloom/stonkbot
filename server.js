const Discord = require("discord.js");
const axios = require("axios");
require("dotenv").config();
const wsClinet = new (require("websocket").client)();
const moment = require("moment");
const Sequelize = require("sequelize");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "stonks.sqlite",
});

const Tickers = sequelize.define("tickers", {
  symbol: {
    type: Sequelize.STRING,
    unique: true,
  },
  lastPrice: {
    type: Sequelize.FLOAT,
  },
});

const Channels = sequelize.define("channels", {
  channel: {
    type: Sequelize.STRING,
    unique: true,
  },
});

const client = new Discord.Client();
const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const rPrice = {};
const lPrice = {};
const directions = {};

const green = "🟩";
const red = "🟥";
const yellow = "🟨";

const PREFIX = "^^";

client.on("ready", () => {
  Tickers.sync();
  Channels.sync();
  console.log(`Logged in as ${client.user.tag}!`);

  wsClinet.on("connect", (connection) => {
    console.log("WebSocket Client Connected");
    Tickers.findAll().then((tickers) => {
      tickers.forEach((ticker) => {
        rPrice[ticker.symbol] = 0;
        lPrice[ticker.symbol] = 0;
        directions[ticker.symbol] = yellow;
        console.log(`subscribing to ${ticker.symbol}`);
        connection.send(
          JSON.stringify({ type: "subscribe", symbol: ticker.symbol })
        );
      });
    });
    connection.on("message", (e) => {
      const { data } = JSON.parse(e.utf8Data);
      if (data) {
        data
          .sort((a, b) => a.t - b.t)
          .forEach((dataPoint) => {
            rPrice[dataPoint.s] = dataPoint.p;
            Tickers.update(
              {
                lastPrice: dataPoint.p,
              },
              {
                where: {
                  symbol: dataPoint.s,
                },
              }
            );
          });
      }
    });
    client.on("message", async (message) => {
      if (
        message.content.startsWith(PREFIX) &&
        message.author.id == "387722383567618051"
      ) {
        const input = message.content.slice(PREFIX.length).trim().split(" ");
        const command = input.shift();
        const commandArgs = input.join(" ");

        if (command == "add") {
          const toAdd = commandArgs.trim();
          Tickers.create({
            symbol: toAdd,
          }).then((ticker) => {
            connection.send(
              JSON.stringify({ type: "subscribe", symbol: ticker.symbol })
            );
            message.reply(`Symbol ${ticker.symbol} added.`);
          });
        } else if (command == "remove") {
          const toDelete = commandArgs.trim();
          Tickers.destroy({
            where: {
              symbol: toDelete,
            },
          }).then((ticker) => {
            connection.send(
              JSON.stringify({ type: "unsubscribe", symbol: toDelete })
            );
            message.reply(`Symbol ${toDelete} removed.`);
          });
        } else if (command == "send") {
          Channels.create({
            channel: message.channel.id,
          }).then(() => {
            message.reply("Subscribed to updates");
          });
        } else if (command == "unsend") {
          Channels.destroy({
            where: {
              channel: message.channel.id,
            },
          }).then(() => {
            message.reply("Unsubscribed to updates");
          });
        }
      }
    });
    setInterval(() => {
      const now = moment();
      let toSend = "";
      Tickers.findAll({
        order: [["symbol", "ASC"]],
      }).then((tickers) => {
        tickers.forEach((ticker, i) => {
          if (rPrice[ticker.symbol] > lPrice[ticker.symbol]) {
            directions[ticker.symbol] = green;
          } else if (rPrice[ticker.symbol] < lPrice[ticker.symbol]) {
            directions[ticker.symbol] = red;
          } else {
            directions[ticker.symbol] = yellow;
          }
          toSend += `\`${directions[ticker.symbol]} ${
            ticker.symbol
          } ${formatter.format(ticker.lastPrice)}\``;
          if (i < tickers.length - 1) {
            toSend += " ";
          }
          lPrice[ticker.symbol] = rPrice[ticker.symbol];
        });
        Channels.findAll().then((channels) => {
          channels.forEach((channel) => {
            client.channels.cache.get(channel.channel).send(toSend);
          });
        });
      });
    }, 30 * 1000);
  });
  wsClinet.connect(`wss://ws.finnhub.io?token=${process.env.FINNHUB_TOKEN}`);
});
client.on("rateLimit", (e) => console.log(e));
client.login(process.env.DISCORD_TOKEN);
