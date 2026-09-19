# Pricing Models — Quick Reference

> Shared resource for all marketing sub-skills. Reference when designing pricing strategy, positioning, or GTM.

## Pricing Strategy Types

### Value-Based Pricing
Price based on the perceived value to the customer, not cost to produce.

- **When to use:** Strong differentiation, measurable ROI, enterprise sales
- **How:** Quantify the customer's alternative cost (time, money, risk) → price at a fraction of that value
- **Example:** If your tool saves 10 hours/week at $100/hr, charge $500/mo (50% of value delivered)
- **Risk:** Requires deep understanding of customer economics; hard to justify without proof

### Usage-Based Pricing
Charge based on consumption (API calls, storage, seats active, transactions).

- **When to use:** Variable usage patterns, developer tools, infrastructure, marketplaces
- **How:** Identify the value metric (the unit that scales with customer value) → price per unit
- **Example:** Stripe (% per transaction), AWS (per compute-hour), Twilio (per message)
- **Risk:** Revenue unpredictable; hard for customers to budget; may discourage usage

### Freemium
Free tier with paid upgrade for advanced features, capacity, or support.

- **When to use:** Large addressable market, low marginal cost, network effects, product-led growth
- **How:** Free tier must deliver real value (not crippled); paid tier unlocks power features
- **Example:** Slack (free up to message limit), Notion (free for individuals), Figma (free for 3 projects)
- **Risk:** Free tier too generous → no conversion; too restrictive → no adoption

### Tiered / Good-Better-Best
Three tiers at increasing price points with increasing capability.

- **When to use:** Multiple customer segments with different needs and budgets
- **How:** Each tier adds clear value; middle tier is the target (anchor the top, nudge from bottom)
- **Tier design:**
  | Tier | Purpose | Price Anchor |
  |---|---|---|
  | **Starter** | Entry point, prove value | Low (attract) |
  | **Pro** | Primary revenue tier | Medium (target) |
  | **Enterprise** | Premium, custom | High (anchor) |
- **Risk:** Too many tiers → decision paralysis; wrong feature splits → wrong tier adoption

### Per-Seat Pricing
Charge per user or per seat.

- **When to use:** Collaboration tools, team products, clear per-user value
- **How:** Price per active seat (not provisioned); volume discounts for larger teams
- **Example:** Salesforce, GitHub, Jira
- **Risk:** Discourages adoption within orgs; seat sharing workarounds; penalizes growth

### Flat-Rate Pricing
Single price for all features, unlimited usage.

- **When to use:** Simple products, anti-complexity positioning, small teams
- **How:** One price, everything included, no surprises
- **Example:** Basecamp ($99/mo flat for unlimited users)
- **Risk:** Leaves money on the table from high-value customers; hard to scale revenue

## Pricing Psychology

| Principle | Application |
|---|---|
| **Anchoring** | Show the most expensive option first to make mid-tier feel reasonable |
| **Decoy effect** | Add a "dominated" option that makes the target tier look like the best deal |
| **Charm pricing** | $49 feels significantly less than $50 (left-digit bias) |
| **Annual discount** | Offer 10-20% off for annual commitment (improves cash flow + retention) |
| **Loss aversion** | Frame as "save $X/year" not "costs $X less" |
| **Social proof** | Label the most popular tier ("Most Popular") |
| **Free trial vs. freemium** | Trial = urgency (14 days), Freemium = patience (use forever, upgrade when ready) |

## Pricing Page Best Practices

1. Show 3 tiers maximum (avoid decision paralysis)
2. Highlight the recommended tier visually
3. Use toggle for monthly/annual (show annual savings)
4. List features in order of importance to buyer (not internal logic)
5. Include a comparison table for detailed feature differences
6. Put social proof near the CTA (customer count, logos, testimonials)
7. Address the #1 objection on the page (usually "What if it doesn't work for me?")
8. Offer a clear path for enterprise/custom needs

## Value Metric Selection

The value metric is the unit you charge for. It should:

1. **Scale with customer value** -- As they get more value, they pay more
2. **Be easy to understand** -- Customer can predict their cost
3. **Be hard to game** -- Difficult to manipulate to avoid charges
4. **Grow naturally** -- Usage increases as the customer succeeds

| Product Type | Common Value Metrics |
|---|---|
| SaaS (collaboration) | Per seat, per workspace |
| SaaS (infrastructure) | Per API call, per GB, per compute-hour |
| Marketplace | % of transaction value |
| Content/media | Per subscriber, per view |
| DevTools | Per build, per deployment, per project |

## When to Change Pricing

| Signal | Action |
|---|---|
| Conversion rate too low | Lower price or add a cheaper tier |
| Churn is high on a tier | Value delivery doesn't match price — fix product or adjust |
| Competitors undercut significantly | Differentiate on value, not price (or match if commodity) |
| Customers say "too cheap" | Raise prices (seriously, test it) |
| Enterprise deals stalling | Add custom tier with dedicated support, SLA, SSO |
| Usage-based costs unpredictable for customers | Add spending caps or committed-use discounts |
