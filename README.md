# stonkbot

pull realtime trades from finhubb and post them to discord channels. currently the same set of tickers will be sent to all subscribed channels.

populate a .env file with the followign values
```
DISCORD_TOKEN=<your discord bot token>
FINNHUB_TOKEN=<your finnhub API key>
```

`npm install`

`node server.js`

invite the bot to your server, then use the following commands:

`^^add <ticker>` - adds ticker to finnhub subscription

`^^remove <ticker>` -  removes ticker from finnhub subscription

`^^send` - post updates in this channel

`^^unsend` - stop posting updates in this channel
