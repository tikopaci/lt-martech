-- SQL Solution for Martech Technical Test
-- Calculates LTV D7, ROAS D7, and Top 3 Countries by ROAS D7

WITH 
-- CTE 1: Calculate LTV D7 for each user (total purchases in 7 days after install)
user_ltv_d7 AS (
  SELECT 
    i.user_id,
    i.campaign_id,
    i.country,
    i.install_ts,
    -- Sum of purchase values within 7 days of install
    COALESCE(SUM(p.value), 0) as ltv_d7
  FROM installs i
  LEFT JOIN purchases p ON i.user_id = p.user_id 
    AND p.event_ts BETWEEN i.install_ts 
    AND TIMESTAMP_ADD(i.install_ts, INTERVAL 7 DAY)
  GROUP BY i.user_id, i.campaign_id, i.country, i.install_ts
),

-- CTE 2: Calculate average LTV D7 per campaign
campaign_ltv_d7 AS (
  SELECT 
    campaign_id,
    COUNT(DISTINCT user_id) as users_count,
    SUM(ltv_d7) as total_revenue_d7,
    -- LTV D7 = total revenue divided by number of users
    SUM(ltv_d7) / COUNT(DISTINCT user_id) as avg_ltv_d7
  FROM user_ltv_d7
  GROUP BY campaign_id
),

-- CTE 3: Calculate ad costs per campaign for D7 window
campaign_costs_d7 AS (
  SELECT 
    ac.campaign_id,
    SUM(ac.cost) as total_cost_d7
  FROM ad_costs ac
  INNER JOIN installs i ON ac.campaign_id = i.campaign_id
  WHERE ac.date BETWEEN DATE(i.install_ts) 
    AND DATE_ADD(DATE(i.install_ts), INTERVAL 7 DAY)
  GROUP BY ac.campaign_id
),

-- CTE 4: Calculate ROAS D7 per campaign (revenue / cost)
campaign_roas_d7 AS (
  SELECT 
    c.campaign_id,
    c.total_revenue_d7,
    c.avg_ltv_d7,
    co.total_cost_d7,
    -- ROAS D7 = revenue / cost
    CASE 
      WHEN co.total_cost_d7 > 0 THEN c.total_revenue_d7 / co.total_cost_d7 
      ELSE NULL 
    END as roas_d7
  FROM campaign_ltv_d7 c
  LEFT JOIN campaign_costs_d7 co ON c.campaign_id = co.campaign_id
),

-- CTE 5: Count installs per country/campaign for proportional cost distribution
country_installs AS (
  SELECT 
    country,
    campaign_id,
    COUNT(*) as installs_count
  FROM installs 
  GROUP BY country, campaign_id
),

-- CTE 6: Calculate revenue per country (sum of user LTV by country)
country_revenue_d7 AS (
  SELECT 
    country,
    campaign_id,
    SUM(ltv_d7) as country_revenue_d7,
    COUNT(DISTINCT user_id) as country_users
  FROM user_ltv_d7
  GROUP BY country, campaign_id
),

-- CTE 7: Distribute campaign costs proportionally by country based on installs
country_costs_d7 AS (
  SELECT 
    ci.country,
    ci.campaign_id,
    ci.installs_count,
    co.total_cost_d7,
    -- Proportional cost = (country installs / total campaign installs) * total cost
    co.total_cost_d7 * ci.installs_count / 
      SUM(ci.installs_count) OVER (PARTITION BY ci.campaign_id) as country_cost_d7
  FROM country_installs ci
  INNER JOIN campaign_costs_d7 co ON ci.campaign_id = co.campaign_id
),

-- CTE 8: Calculate ROAS D7 per country (aggregating across campaigns)
country_roas_d7 AS (
  SELECT 
    cr.country,
    SUM(cr.country_revenue_d7) as total_country_revenue_d7,
    SUM(cc.country_cost_d7) as total_country_cost_d7,
    -- Country ROAS D7 = total country revenue / total country cost
    CASE 
      WHEN SUM(cc.country_cost_d7) > 0 THEN 
        SUM(cr.country_revenue_d7) / SUM(cc.country_cost_d7)
      ELSE NULL 
    END as country_roas_d7
  FROM country_revenue_d7 cr
  INNER JOIN country_costs_d7 cc 
    ON cr.country = cc.country AND cr.campaign_id = cc.campaign_id
  GROUP BY cr.country
)

-- Main Query: Top 3 countries by ROAS D7
SELECT 
  country,
  ROUND(total_country_revenue_d7, 2) as total_revenue_d7,
  ROUND(total_country_cost_d7, 2) as total_cost_d7,
  ROUND(country_roas_d7, 4) as roas_d7
FROM country_roas_d7
WHERE country_roas_d7 IS NOT NULL
ORDER BY country_roas_d7 DESC
LIMIT 3;
