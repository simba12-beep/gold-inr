#!/usr/bin/env node
// Live gold price in INR per gram — console tracker (Node 18+, no dependencies)
// Usage: node gold-inr.js [dutyPercent=15] [refreshSec=30] [alertAt10g]
// e.g.   node gold-inr.js 15 30 150000

const OZ = 31.1035;
const DUTY = parseFloat(process.argv[2] ?? 15);
const EVERY = Math.max(10, parseFloat(process.argv[3] ?? 30));
const ALERT = process.argv[4] ? parseFloat(process.argv[4]) : null;
const KARATS = [["24K", 0.999], ["22K", 0.916], ["18K", 0.75]];

let fx = null, fxTime = 0, first = null, prev = null, lastSide = null;
const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");
const pad = (s, n) => String(s).padStart(n);

async function getFx() {
  if (fx && Date.now() - fxTime < 3600e3) return fx;
  const j = await (await fetch("https://open.er-api.com/v6/latest/USD")).json();
  fx = j.rates.INR; fxTime = Date.now();
  return fx;
}
async function getGold() {
  const j = await (await fetch("https://api.gold-api.com/price/XAU")).json();
  return j.price;
}

async function tick() {
  try {
    const [xau, rate] = await Promise.all([getGold(), getFx()]);
    first ??= xau;
    const mult = 1 + DUTY / 100;
    const spotGram = (xau / OZ) * rate;
    const arrow = prev == null ? " " : xau > prev ? "\x1b[32m▲\x1b[0m" : xau < prev ? "\x1b[31m▼\x1b[0m" : "=";
    prev = xau;

    console.clear();
    console.log(`\x1b[33mGOLD IN INR\x1b[0m   ${new Date().toLocaleTimeString()}   (refresh ${EVERY}s, Ctrl+C to quit)\n`);
    console.log(`XAU/USD  $${xau.toFixed(2)} /oz ${arrow}   (${(((xau - first) / first) * 100).toFixed(2)}% since start)`);
    console.log(`USD/INR  ${rate.toFixed(2)}     Duty+tax ${DUTY}%\n`);
    console.log(`${"Purity".padEnd(8)}${pad("Per gram", 12)}${pad("10 grams", 14)}${pad("Spot/gram", 13)}`);
    console.log("-".repeat(47));
    for (const [k, p] of KARATS) {
      const g = spotGram * p * mult;
      console.log(`${k.padEnd(8)}${pad(inr(g), 12)}${pad(inr(g * 10), 14)}${pad(inr(spotGram * p), 13)}`);
    }

    if (ALERT) {
      const ten = spotGram * 0.999 * mult * 10;
      const side = ten >= ALERT ? "ABOVE" : "BELOW";
      console.log(`\nAlert level ${inr(ALERT)} (24K/10g): currently ${side}`);
      if (lastSide && side !== lastSide) console.log(`\x07\x1b[1;35m*** CROSSED ${side} ${inr(ALERT)} ***\x1b[0m`);
      lastSide = side;
    }
  } catch (e) {
    console.error("Fetch failed, retrying:", e.message);
  }
}

tick();
setInterval(tick, EVERY * 1000);
