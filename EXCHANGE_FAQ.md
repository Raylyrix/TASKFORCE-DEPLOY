# ❓ Exchange FAQ - Common Questions

## Q1: Who buys our crypto when we sell?

**A:** The exchange market! Think of it like this:

- **Stock Market:** When you sell Apple stock, you don't find a specific buyer. The market matches you with buyers automatically.
- **Crypto Exchange:** Same thing! Thousands of people want to buy ETH with INR at any given moment.

**Example:**
```
Binance Exchange (ETH/INR pair):
- 24h volume: ₹2,500 crores
- Active buyers: 10,000+ at any moment
- Our sell: 0.004 ETH = ₹1,000 (0.00004% of daily volume)
- Result: Sells instantly, no problem!
```

## Q2: What if there are no buyers?

**A:** This almost never happens for popular pairs, but we have safeguards:

1. **High Liquidity Pairs:** We only use ETH/INR, BTC/INR, SOL/INR (very liquid)
2. **Multiple Exchanges:** If one fails, try another
3. **Market Makers:** Professional traders always provide liquidity
4. **Fallback:** If can't sell now, wait and retry (usually works within minutes)

## Q3: How fast does it sell?

**A:** Market orders execute in **< 1 second** typically.

```
Time: 0.0s - We place order: "Sell 0.004 ETH"
Time: 0.1s - Exchange finds buyer from order book
Time: 0.2s - Trade matched
Time: 0.3s - Trade executed
Time: 0.4s - Money in our account
```

## Q4: What if the price drops while selling?

**A:** We use **market orders** which execute instantly, so price doesn't change much. For small amounts (₹1,000), slippage is usually < 0.1%.

**Example:**
```
Expected: ₹1,000.00
Actual: ₹999.60
Slippage: ₹0.40 (0.04%)
```

## Q5: Do we need to find buyers ourselves?

**A:** No! The exchange does it automatically. It's like:
- **eBay:** You list item, buyers find you
- **Exchange:** You place sell order, exchange matches you with buyers instantly

## Q6: What if exchange is down?

**A:** We have multiple exchanges as backup:
1. Primary: WazirX
2. Backup: CoinDCX
3. Backup: Binance

If one fails, we try the next.

## Q7: How do we know we'll get a fair price?

**A:** Market orders execute at the **best available price** (highest buyer). The exchange ensures you get the best deal from the order book.

## Q8: Can we sell large amounts?

**A:** Yes, but:
- Small amounts (< ₹10,000): Instant, no problem
- Medium amounts (₹10,000 - ₹1,00,000): Might take a few seconds
- Large amounts (> ₹1,00,000): Might need to split into smaller orders

For our use case (₹1,000 payments), it's always instant!

## Q9: What about fees?

**A:** Exchanges charge small fees:
- **WazirX:** 0.1% (₹1 on ₹1,000)
- **Binance:** 0.1% (₹1 on ₹1,000)
- **CoinDCX:** 0.1% (₹1 on ₹1,000)

Very reasonable for instant execution!

## Q10: Is this legal/compliant?

**A:** Yes, as long as:
- Exchange is licensed (WazirX, Binance are licensed in India)
- We follow KYC/AML requirements
- We comply with RBI regulations
- We report transactions as required

---

**Bottom Line:** Exchanges work like a marketplace. When we want to sell, there are always buyers ready. It's automatic, fast, and reliable!

