**ADR: Copilot Token-Based Billing --- Pooled Entitlements, License
Integration & User-Level Budgets** 

**Status:** Draft **Date:** 2026-03-10 **Author:** Brittany Ellich  

 

​​ 

> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline} 
>
> [​]{.underline}​ 

 

**1. Background & Problem Statement** 

**Context** 

Token-based billing (TBB) introduces a fundamental shift in how Copilot
usage is measured and billed. Usage will transition from Premium Request
Units (PRUs) to AI Units (AIUs) at a rate of **\$0.01 per AIU**, with
the AIU quantity provided by the Copilot limiter. This change coincides
with the introduction of **pooled entitlements** --- a mechanism where
an organization or enterprise\'s total included AIU allocation is pooled
across all licensed users, rather than tracked individually. 

**Scale** 

  ------------------------------------------------------------------------------------
  **Customer      **Estimated   **Metered?**    **License Source **License Source
  Segment**       Count**                       (Current)**      (Future)** 
  --------------- ------------- --------------- ---------------- ---------------------
  CB (Copilot for \~116K (mixed Yes             Copilot          Licensify 
  Business)       with CE)                      Read-Only DB     

  CE (Copilot     \~116K (mixed Yes             Copilot          Licensify 
  Enterprise)     with CB)                      Read-Only DB     

  CFI (Copilot    \~1.6M        No (only        Dotcom (push     Possibly Licensify 
  for                           overages)       notification)    
  Individuals)                                                   
  ------------------------------------------------------------------------------------

 

This plan includes introducing Multi-User Customer budgets for **every
Org/Enterprise customer**, which means a single budget for each customer
and a budget state per individual that uses any usage (both paid and
unpaid, as this will be used to track included usage amounts). 

**Problem** 

Billing platform must: 

1.  **Know the license count per customer, broken down by SKU**, and
    keep it fresh. 

<!-- -->

2.  **Calculate a pooled AIU entitlement** based on those license
    counts, creating a credit (discount) at the start of each billing
    cycle. 

<!-- -->

3.  **Update the pool mid-month** when licenses are added, upgraded, or
    otherwise changed, with prorated credits. 

<!-- -->

4.  **Integrate pooled entitlements with user-level
    budgets** (MultiUserCustomer budgets) so that a single user cannot
    consume the entire pool, while tracking both discounted and paid
    usage separately on each budget. 

<!-- -->

5.  **Create default \$0 MultiUserCustomer budgets** for all
    org/enterprise Copilot users, enforcing that users can only consume
    their included (discounted) amount unless an admin explicitly raises
    their budget. 

 

**2. Goals & Non-Goals** 

**Goals** 

- Billing platform accurately tracks pooled AIU entitlements for CB/CE
  customers based on current license counts. 

<!-- -->

- Entitlement amounts per SKU are highly configurable via aiulist.json. 

<!-- -->

- Pool is unified per customer with blended pricing (CB and CE licenses
  contribute different AIU amounts to a single pool). 

<!-- -->

- Mid-month license additions and upgrades trigger pool recalculation
  with prorated credits. 

<!-- -->

- MultiUserCustomer budgets track both discounted (included) and paid
  usage amounts per user. 

<!-- -->

- Default \$0 MultiUserCustomer budgets are created for all
  org/enterprise Copilot users. 

<!-- -->

- Soft limit budget support is added for MultiUserCustomer budgets. 

<!-- -->

- Architecture supports migration from Copilot Read-Only
  DB (dotcom) to Licensify with minimal code changes. 

<!-- -->

- Org-level MultiUserCustomer budgets are supported (currently
  enterprise-only). 

**Non-Goals (Out of Scope)** 

- CFI session windows / 5-hour rate limits (not a billing concern; this
  is a rate limit and should probably be in Redis which we don't have in
  billing platform). 

<!-- -->

- Copilot Ultra. 

<!-- -->

- Licensify accuracy during Licensing cutover (Licensing team's
  responsibility). 

<!-- -->

- Changes to how CFI customers are billed beyond pooled entitlement
  tracking. 

 

**3. Architecture Decisions** 

**AD-1: Lazy Pool Creation with Pre-Stored License Amounts** 

**Decision:** Use a combination of pre-stored license amounts at month
boundary and confirmation on first usage emission. 

**Rationale:** We currently use a similar pattern for plan discounts. At
the start of each billing cycle, we know that there is a discount for
each customer using the **last known license count** (stored on the
customer object). When the first Copilot usage emission arrives for the
month, we query the Copilot Read-Only DB for the current license count,
confirm or correct the provisional amount, and set the statuson the
discount document to \"confirmed.\" 

**Why this approach:** 

- Avoids the thundering herd problem of syncing all 116K CB/CE customers
  at midnight on the 1st. 

<!-- -->

- Concurrent usage emissions for the same customer see an existing
  (provisional) container immediately, avoiding the race condition where
  a discount doesn\'t exist yet. 

<!-- -->

- Naturally spreads license-count query load over the first days of the
  month. 

<!-- -->

- Mirrors existing plan discount patterns. 

**Existing pattern reference:** Plan discount creation at usage
ingestion cycle start. 

**AD-2: Optimistic Concurrency for Pool Updates** 

**Decision:** Use Cosmos DB etag-based conditional writes for all pool
discount state mutations. 

**Rationale:** Multiple usage emissions for the same customer can arrive
simultaneously. When confirming the provisional container or applying
mid-month recalculations, we use optimistic concurrency: read the
current state + etag, compute the update, and write with
an If-Match header. On conflict, retry with the latest state. 

**Existing pattern reference:** Cosmos DB etag-based writes are used
throughout billing platform for state mutations. 

**AD-3: Mid-Month Pool Recalculation via License Change Events** 

**Decision:** When a license change event is received (addition,
upgrade, or removal), recalculate the pool and adjust credits with
proration. 

**Triggers:** 

- **License added:** is_added_license = true on usage emission
  (currently being added to emission schema; Licensify will include this
  natively). 

<!-- -->

- **License upgraded (CB → CE):** Licensify can support this event.
  Until then, we rely on the Copilot team\'s emission, which may have a
  delay. 

<!-- -->

- **License removed:** is_removed_license event (to be added
  by Licensify or Copilot team). The pool does **not** shrink mid-month
  (credits persist through the billing cycle), but we decrement the
  stored license count so that next month\'s pool starts with an
  accurate amount. This re-introduces **high watermark
  logic** in billing platform. 

**For CFI customers:** Since CFI does not emit metered license usage,
mid-month changes will be triggered via a **Hydro event** for license
changes (push notification from Copilot/dotcom). 

**AD-4: Abstract the License Source Behind an Interface** 

**Decision:** Introduce a LicenseSource interface that abstracts where
license counts come from. 

type LicenseSource interface { \
    GetLicenseCounts(ctx context.Context, customerID string)
(\*LicenseCounts, error) \
} \
 \
type LicenseCounts struct { \
    Licenses \[\]LicenseEntry \
    AsOf     time.Time \
} \
 \
type LicenseEntry struct { \
    SKU                string  // \"copilot_for_business\",
\"copilot_enterprise\", etc. \
    Count              int \
    AIUsPerSeat        int     // configurable via aiulist.json \
    RatePerAIU         float64 // \$0.01 \
} \
  

**Current implementation:** Queries the Copilot Read-Only DB from dotcom
(API call). **Future
implementation:** Queries Licensify API. **Migration:** Swap
implementation behind a feature flag. No changes to pool calculation,
credit creation, or concurrency logic. 

**AD-5: Unified Pool with Blended Pricing** 

**Decision:** All Copilot license types for a customer contribute to a
single, unified AIU pool. The pool size is the sum
of (license_count × AIUs_per_seat) across all SKUs. 

**Example:** 

- 100 CB licenses × 300 AIUs/seat = 30,000 AIUs 

<!-- -->

- 50 CE licenses × 1,000 AIUs/seat = 50,000 AIUs 

<!-- -->

- **Total pool: 80,000 AIUs** at \$0.01/AIU = \$800 total credit 

Any user with a seat can draw from the pool regardless of their license
type. The AIU amounts per SKU are configured in aiulist.json and must be
clearly documented. 

**Existing pattern reference:** skulist.json configuration for SKU-level
parameters. 

**AD-6: Discount Amount Tracking on Budget State** 

**Decision:** The MultiUserCustomer budget state will track both
discounted and paid usage. This is the **first instance** where a budget
is used to track both discount amount and budget amount. 

The budget state will include: 

- currentAmount: Total usage (discounted + paid) for the user. 

<!-- -->

- discountAmount: How much of currentAmount was covered by the pooled
  entitlement (discount). 

The paid amount is
derived: paidAmount = currentAmount - discountAmount. 

The budget\'s targetAmount represents the **paid** budget
limit. CanProceedWithUsage returns false when (currentAmount - discountAmount)
\>= targetAmount (i.e., when the paid portion meets or exceeds the paid
budget limit). 

The **included amount** is not stored on the budget. It is calculated
during usage ingestion based on: 

1.  How much remains in the pool-level discount state. 

<!-- -->

2.  The user\'s license type (derived from the usage emission). 

When displaying the budget to users, we calculate the **effective total
budget** as targetAmount + included_amount_for_license_type to show the
complete picture. 

**Existing pattern
reference:** MultiUserCustomer budget currentAmount tracking.
New: discountAmount and licenseType field on user budget state. 

**AD-7: Default \$0 MultiUserCustomer Budgets** 

**Decision:** On GA (June 1st), create default
\$0 targetAmount MultiUserCustomer budgets for all existing
org/enterprise Copilot users via a transition. 

**What this means:** 

- Users can consume their included (discounted) AIU amount from the
  pool. 

<!-- -->

- Users **cannot** consume any paid usage beyond the included amount
  unless an admin explicitly raises their targetAmount. 

<!-- -->

- This is a **breaking behavioral change** for customers whose users
  previously had no budget limits. 

**⚠️ RISK: This means we will not generate any revenue from AI Units for
users on default budgets.** This is the opposite of last year\'s revenue
goal. This must be explicitly communicated to revenue stakeholders and
documented in the decision log. 

**Transition logistics:** 

- Transition creation takes approximately **1 week**. 

<!-- -->

- We need to create the budgets ahead of time but **not enable
  enforcement until June 1st**. This likely requires a feature flag
  gating CanProceedWithUsage enforcement for these default budgets.  

<!-- -->

- Alternatively we could skip the transition and do a dynamic creation
  with the first usage, but then we need to keep track of which users
  already removed their \$0 budget. 

<!-- -->

- This should be communicated heavily with support who will get the
  brunt of the "Why did my usage stop" questions. 

**AD-8: Soft Limit Support for MultiUserCustomer Budgets** 

**Decision:** Add soft limit budget support
for MultiUserCustomer budgets. When a budget is configured as a soft
limit, usage beyond the budget amount is tracked but not blocked
(CanProceedWithUsagealways returns true). 

**Rationale:** Default \$0 budgets with hard limits may be too
restrictive for some customers. Soft limits allow organizations
to monitor usage patterns without blocking users, providing a gentler
transition. 

**Existing pattern reference:** Soft limit budgets exist for other
budget types but are **not currently
enabled** for MultiUserCustomer budgets. This requires extending the
existing soft limit implementation to cover MultiUserCustomer budgets. 

**AD-9: Expand MultiUserCustomer Budgets to Orgs** 

**Decision:** MultiUserCustomer budgets are currently enterprise-only.
Expand support to organization-level customers. 

**Rationale:** Orgs also have Copilot licenses (CB) and will need
user-level budget controls for the same reasons as enterprises ---
preventing single-user pool exhaustion. 

 

**4. Data Model** 

**4.1 Pool-Level Discount State (New --- Cosmos DB)** 

{ \
  \"partitionKey\": \"customer:12345:copilot_aiu_pool\", \
  \"id\": \"aiu_pool\", \
  \"licenses\": { \
    \"copilot_for_business\": { \
      \"currentCount\": 110, \
 \
      \"monthlyCount\": 100 \
    }, \
    \"copilot_enterprise\": { \
      \"monthlyCount\": 50, \
 \
      \"currentCount\": 50 \
    } \
  } \
 \
  \"licenseSource\": \"copilot_readonly_db\", \
  \"lastRecalculatedAt\": \"2026-06-01T03:00:00Z\", \
  \"createdAt\": \"2026-05-31T23:30:00Z\", \
  \"\_etag\": \"\...\" \
} \
  

**Notes:** 

- MonthlyCount tracks the value where we'll start next month 

<!-- -->

- status indicator: lastRecalculatedAt -\> Recalculated at
  the beginnong of next month 

<!-- -->

- Setting this will also allow us to create a manual "sync licenses"
  button in stafftools which I'm thinking will be useful for support
  problems related to it 

<!-- -->

- Consider what TTL needs to be added to these documents. 

**4.2 Budget State Changes (Modified ---
Existing MultiUserCustomer Budget)** 

**Existing fields:** 

- currentAmount --- Total usage for the user (both included and paid). 

**New field:** 

- discountAmount --- How much of currentAmount was covered by
  pooled entitlement. 

{ \
  \"partitionKey\": \"budget:customer:12345:user:789\", \
  \"budgetId\": \"\...\", \
  \"currentAmount\": 8.50, \
  \"discountAmount\": 6.00, 

     \"licenseType\": "copilot_for_business", \
  \"\_etag\": \"\...\" \
} \
  

**Derived values (not stored):** 

- paidAmount = currentAmount - discountAmount → \$2.50 

<!-- -->

- includedAmountForLicenseType → derived from license type on emission
  + aiulist.json 

<!-- -->

- effectiveTotalBudget = targetAmount + includedAmountForLicenseType →
  for UI display 

**4.3 Budget (Modified --- Existing)** 

- targetAmount: Now represents **paid** budget limit only (e.g., \$0 for
  default budgets). 

<!-- -->

- New: limitType field or flag to indicate soft vs. hard limit
  for MultiUserCustomer budgets. 

**4.4 Customer Object (Modified --- Existing)** 

- Store lastKnownLicenseCount per SKU on the customer object, used for
  provisional pool pre-creation at month boundary. 

**4.5 aiulist.json (Modified --- Existing)** 

Add AIU entitlement configuration per Copilot SKU: 

{ \
  \"copilot_for_business\": { \
    \"included_aius_per_seat\": 300, \
    \"rate_per_aiu\": 0.01 \
  }, \
  \"copilot_enterprise\": { \
    \"included_aius_per_seat\": 1000, \
    \"rate_per_aiu\": 0.01 \
  } \
} \
  

**Note:** These values are placeholders. Final included AIU amounts are
TBD and may change before release. The configuration must be clearly
documented and easy to update. 

 

**5. High-Level Scope of Changes** 

**5.1 Pooled Entitlement --- Pool Creation & Lifecycle** 

  -----------------------------------------------------------------------------------------------------------------
  **\#**    **Change**                              **Description**                                   **Estimated
                                                                                                      Effort** 
  --------- --------------------------------------- ------------------------------------------------- -------------
  5.1.1     **Add AIU entitlement config            Add included_aius_per_seat and rate_per_aiu per   *\[TBD\]* 
            to aiulist.json**                       Copilot SKU. Document all values clearly.         

  5.1.2     **Store last known license count on     When license counts are confirmed or              *\[TBD\]* 
            customer object**                       updated, persist the count per SKU on the         
                                                    customer record for use in provisional            
                                                    pre-creation.                                     

  5.1.3     **Pre-create provisional pool discount  At billing cycle start, create a provisional      *\[TBD\]* 
            container at month boundary**           discount state for each CB/CE customer using      
                                                    their last known license count. Pattern follows   
                                                    existing plan discount pre-creation.              

  5.1.4     **Implement LicenseSourceinterface**    Abstract license count retrieval behind an        *\[TBD\]* 
                                                    interface. Initial implementation queries Copilot 
                                                    Read-Only DB.                                     

  5.1.5     **Confirm pool on first emission**      On first Copilot usage emission of the month,     *\[TBD\]* 
                                                    query LicenseSource for current count, update     
                                                    provisional container to confirmed, adjust pool   
                                                    if counts differ. Use etag-based optimistic       
                                                    concurrency.                                      

  5.1.6     **Pool consumption during usage         When Copilot AIU usage is processed, atomically   *\[TBD\]* 
            processing**                            decrement the pool\'s remaining amount.           
                                                    If pool is exhausted, usage becomes paid.         
  -----------------------------------------------------------------------------------------------------------------

**5.2 Pooled Entitlement --- Mid-Month Recalculation** 

  ------------------------------------------------------------------------------------------------
  **\#**    **Change**                             **Description**                   **Estimated
                                                                                     Effort** 
  --------- -------------------------------------- --------------------------------- -------------
  5.2.1     **Handle is_added_licenseevent**       When a license addition event is  *\[TBD\]* 
                                                   received (via usage emission      
                                                   or Licensify), recalculate the    
                                                   pool with the new count. Add      
                                                   prorated AIU credit for the       
                                                   remaining days in the cycle.      

  5.2.2     **Handle license upgrade (CB → CE)**   When a license type change is     *\[TBD\]* 
                                                   detected, recalculate the pool    
                                                   (remove CB entitlement, add CE    
                                                   entitlement for that seat).       
                                                   Prorate the delta.                

  5.2.3     **Handle is_removed_license event**    Do **not** shrink                 *\[TBD\]* 
                                                   the pool mid-month. Decrement the 
                                                   stored lastKnownLicenseCount on   
                                                   the customer object.              
                                                   Update highWatermarktracking on   
                                                   the pool state.                   

  5.2.4     **Hydro event listener for CFI license Subscribe to Hydro events for CFI *\[TBD\]* 
            changes**                              license changes to trigger pool   
                                                   recalculation for individual      
                                                   customers.                        
  ------------------------------------------------------------------------------------------------

**5.3 Pooled Entitlement --- CFI-Specific** 

  -------------------------------------------------------------------------------
  **\#**    **Change**                    **Description**           **Estimated
                                                                    Effort** 
  --------- ----------------------------- ------------------------- -------------
  5.3.1     **CFI pool creation on        Lazy-create the pool for  *\[TBD\]* 
            first premium_request_unit/   CFI customers when their  
            AIU emission**                first overage emission    
                                          arrives. Assume 1 license 
                                          per customer. Derive SKU  
                                          tier from emission.       

  5.3.2     **CFI customer                Ensure processing         *\[TBD\]* 
            differentiation**             pipeline can distinguish  
                                          CFI from CB/CE customers  
                                          to route through the      
                                          correct pool creation     
                                          path.                     

  5.3.3     **Support multiple CFI SKU    As CFI expands to         *\[TBD\]* 
            tiers**                       multiple SKU tiers with   
                                          different entitlement     
                                          amounts, ensure the pool  
                                          creation                  
                                          and aiulist.json config   
                                          support this.             
  -------------------------------------------------------------------------------

**5.4 MultiUserCustomer Budgets --- Discount Tracking** 

  -------------------------------------------------------------------------------------------------------------------
  **\#**    **Change**                              **Description**                                     **Estimated
                                                                                                        Effort** 
  --------- --------------------------------------- --------------------------------------------------- -------------
  5.4.1     **Add discountAmountto budget state**   New field on MultiUserCustomer budget state to      *\[TBD\]* 
                                                    track how much of currentAmount was covered by      
                                                    pooled entitlement.                                 

  5.4.2     **Update usage ingestion to split       During usage processing, determine if pool has      *\[TBD\]* 
            discount vs. paid**                     remaining entitlement. If yes, increment            
                                                    both currentAmount and discountAmount. If pool      
                                                    exhausted, increment only currentAmount.            

  5.4.3     **Update CanProceedWithUsage logic**    Budget limit check                                  *\[TBD\]* 
                                                    becomes: (currentAmount - discountAmount)           
                                                    \>= targetAmount. Only paid usage counts against    
                                                    the budget limit.                                   

  5.4.4     **Derive included amount from license   Use the license type from the usage emission        *\[TBD\]* 
            type during ingestion**                 (provided by limiter team) to look up the per-seat  
                                                    included amount from aiulist.json. Calculate the    
                                                    effective budget amount dynamically.                

  5.4.5     **UI changes for budget display**       Display effective total budget                      *\[TBD\]* 
                                                    (targetAmount + included_amount_for_license_type)   
                                                    in the user-level budget views. Differentiate       
                                                    discounted vs. paid usage in the UI.                
  -------------------------------------------------------------------------------------------------------------------

**5.5 MultiUserCustomer Budgets --- Default \$0 Budgets** 

  ----------------------------------------------------------------------------------
  **\#**    **Change**     **Description**                             **Estimated
                                                                       Effort** 
  --------- -------------- ------------------------------------------- -------------
  5.5.1     **Build        Create                                      *\[TBD\]* 
            transition to  \$0 targetAmount MultiUserCustomerbudgets   
            create \$0     for all existing org/enterprise Copilot     
            default        users. Transition takes \~1 week to build.  
            budgets**                                                  

  5.5.2     **Feature flag Budgets are created ahead of time but       *\[TBD\]* 
            for            enforcement                                 
            enforcement    (CanProceedWithUsage returning false) is    
            gating**       gated behind a feature flag that is enabled 
                           on June 1st.                                

  5.5.3     **Default      When new org/enterprise Copilot customers   *\[TBD\]* 
            budget         are onboarded after June 1st, automatically 
            creation for   create \$0                                  
            new            default MultiUserCustomer budgets for their 
            customers**    users.                                      
  ----------------------------------------------------------------------------------

**5.6 MultiUserCustomer Budgets --- Soft Limits** 

  -------------------------------------------------------------------------------------------
  **\#**    **Change**                        **Description**                   **Estimated
                                                                                Effort** 
  --------- --------------------------------- --------------------------------- -------------
  5.6.1     **Enable soft limit support       Extend existing soft limit        *\[TBD\]* 
            for MultiUserCustomerbudgets**    implementation                    
                                              to MultiUserCustomer budget type. 
                                              When soft limit is                
                                              set, CanProceedWithUsage always   
                                              returns true but usage is still   
                                              tracked.                          

  5.6.2     **Allow configuration of soft vs. Admins can choose whether the     *\[TBD\]* 
            hard limit on default budgets**   default \$0 budget is a hard or   
                                              soft limit.                       
  -------------------------------------------------------------------------------------------

**5.7 MultiUserCustomer Budgets --- Org Expansion** 

  --------------------------------------------------------------------------------
  **\#**    **Change**                          **Description**      **Estimated
                                                                     Effort** 
  --------- ----------------------------------- -------------------- -------------
  5.7.1     **Expand MultiUserCustomerbudgets   Currently            *\[TBD\]* 
            to orgs**                           enterprise-only.     
                                                Enable for           
                                                organization-level   
                                                customers.           

  5.7.2     **Org-level UI for user budgets**   Ensure the           *\[TBD\]* 
                                                user-level budget    
                                                management UI works  
                                                for org admins (not  
                                                just enterprise      
                                                admins).             
  --------------------------------------------------------------------------------

**5.8 Scalability & Performance** 

  ------------------------------------------------------------------------------------------------
  **\#**    **Change**          **Description**                                      **Estimated
                                                                                     Effort** 
  --------- ------------------- ---------------------------------------------------- -------------
  5.8.1     **Capacity          Investigate Cosmos DB throughput and performance     *\[TBD\]* 
            investigation for   implications of creating MultiUserCustomer budgets   
            default budget      for all org/enterprise Copilot                       
            creation at         users. Previous slowdowns were observed with default 
            scale**             customer budgets.                                    

  5.8.2     **Budget-specific   If scalability investigation reveals issues, create  *\[TBD\]* 
            Cosmos container    a dedicated Cosmos container for budget state to     
            (potential)**       isolate throughput.                                  

  5.8.3     **Aggregation for   With default budgets for all users, the user-level   *\[TBD\]* 
            budget breadcrumb   budget list page may have scalability issues.        
            page**              Investigate and implement pagination/aggregation as  
                                needed.                                              

  5.8.4     **Pool consumption  Load test the atomic pool decrement path under burst *\[TBD\]* 
            concurrency         conditions (many users consuming simultaneously).    
            testing**                                                                
  ------------------------------------------------------------------------------------------------

**5.9 Licensify Migration Preparation** 

  ------------------------------------------------------------------------------------------------------
  **\#**    **Change**                                  **Description**                    **Estimated
                                                                                           Effort** 
  --------- ------------------------------------------- ---------------------------------- -------------
  5.9.1     **LicensifyLicenseSourceimplementation**    When Licensify is ready for        *\[TBD\]* 
                                                        Copilot, implement                 
                                                        the LicenseSource interface        
                                                        against Licensify\'s API.          

  5.9.2     **Feature flag for license source swap**    Gate                               *\[TBD\]* 
                                                        the LicenseSource implementation   
                                                        behind a feature flag to enable    
                                                        seamless cutover.                  

  5.9.3     **Regular verification/sync job**           Implement a periodic job that      *\[TBD\]* 
                                                        compares billing platform\'s       
                                                        stored license counts              
                                                        against Licensify\'s source of     
                                                        truth, logging and alerting        
                                                        on discrepancies.                  
  ------------------------------------------------------------------------------------------------------

**5.10 Open Question: Discount Amount on Other Budget Types** 

  -----------------------------------------------------------------------
  **\#**    **Change**         **Description**              **Estimated
                                                            Effort** 
  --------- ------------------ ---------------------------- -------------
  5.10.1    **Determine if     Clarify whether              *\[TBD\]* 
            enterprise-level   the discountAmount concept   
            budgets need       needs to extend to           
            discount           enterprise-level or other    
            tracking**         budget types for Copilot AIU 
                               tracking. Hoping this is     
                               not needed, but requires     
                               explicit confirmation.       

  -----------------------------------------------------------------------

 

**6. Phased Implementation Plan** 

**Phase 1: Private Preview --- Enterprise User-Level Budgets (Target:
April 1st)** 

**Scope:** Ship user-level budgets for enterprises in private preview.
This is the current in-flight work. 

  --------------------------------------------------
  **Item**                               **Ref** 
  -------------------------------------- -----------
  Enterprise MultiUserCustomer budgets   Existing 
  (existing work)                        

  In-product banner (PR ready)           Existing 

  Testing & validation                   Existing 
  --------------------------------------------------

**Note:** Pooled entitlements are NOT included in this phase. This ships
the budget infrastructure that will later integrate with the pool. 

**Phase 2: Pooled Entitlement --- Core Pool Lifecycle
(Target: *\[TBD\]*)** 

**Scope:** Pool creation, confirmation, consumption, and mid-month
recalculation for CB/CE. 

  ------------------------------------------
  **Item**                        **Ref** 
  ------------------------------- ----------
  AIU config in aiulist.json      5.1.1 

  Last known license count on     5.1.2 
  customer object                 

  Provisional pool pre-creation   5.1.3 

  LicenseSource interface +       5.1.4 
  Copilot Read-Only DB impl       

  Pool confirmation on first      5.1.5 
  emission                        

  Pool consumption during usage   5.1.6 
  processing                      

  is_added_license handling       5.2.1 

  License upgrade handling        5.2.2 

  is_removed_license handling +   5.2.3 
  high watermark                  
  ------------------------------------------

**Dependencies:** 

- is_added_license field on usage emissions (Copilot team / Licensify) 

<!-- -->

- is_removed_license event (Copilot team / Licensify) 

<!-- -->

- AIU quantity on usage emissions from limiter team 

**Phase 3: Budget + Pool Integration (Target: *\[TBD\]*)** 

**Scope:** Wire pooled entitlements into MultiUserCustomer budgets. 

  ----------------------------------------
  **Item**                      **Ref** 
  ----------------------------- ----------
  discountAmount on budget      5.4.1 
  state                         

  Usage ingestion: discount vs. 5.4.2 
  paid split                    

  CanProceedWithUsage update    5.4.3 

  License type derivation       5.4.4 
  during ingestion              

  UI changes for budget         5.4.5 
  display                       
  ----------------------------------------

**Dependencies:** 

- Phase 2 complete 

<!-- -->

- License type on usage emission from limiter team 

**Phase 4: Scalability & Hardening (Target: *\[TBD\]*)** 

**Scope:** Performance validation and scalability improvements. 

  ----------------------------
  **Item**          **Ref** 
  ----------------- ----------
  Capacity          5.8.1 
  investigation     

  Budget-specific   5.8.2 
  Cosmos container  
  (if needed)       

  Budget list page  5.8.3 
  aggregation       

  Pool concurrency  5.8.4 
  load testing      
  ----------------------------

 

**Phase 5: Default Budgets, Soft Limits & Org Expansion (Target: June
1st GA)** 

**Scope:** Create default \$0 budgets, enable soft limits, expand to
orgs. 

  -------------------------------------------
  **Item**                         **Ref** 
  -------------------------------- ----------
  Transition: create \$0 default   5.5.1 
  budgets                          

  Feature flag for enforcement     5.5.2 
  gating                           

  Default budget creation for new  5.5.3 
  customers                        

  Soft limit support               5.6.1,
  for MultiUserCustomer budgets    5.6.2 

  Org expansion                    5.7.1,
  for MultiUserCustomer budgets    5.7.2 
  -------------------------------------------

**Dependencies:** 

- Phases 2 & 3 complete 

<!-- -->

- Decision from revenue stakeholders on \$0 default budget implications 

<!-- -->

- \~1 week lead time for transition creation (must be created before
  June 1st but not enforced until then) 

**Phase 6: CFI Integration (Target: *\[TBD\]*) (potentially
not required)** 

**Scope:** Pooled entitlements for Copilot for Individuals. 

  -----------------------------
  **Item**           **Ref** 
  ------------------ ----------
  CFI pool creation  5.3.1 
  on first overage   
  emission           

  CFI customer       5.3.2 
  differentiation    

  Multiple CFI SKU   5.3.3 
  tier support       

  Hydro event        5.2.4 
  listener for CFI   
  license changes    
  -----------------------------

**Dependencies:** 

- Hydro event for CFI license changes (Copilot team) 

<!-- -->

- Clarity on whether CFI onboards to Licensify (and timeline) 

**Phase 7: Licensify Migration (Target: *\[TBD\]* --- when Licensify is
ready)** 

**Scope:** Swap license source to Licensify. 

  ----------------------------------------------------
  **Item**                                  **Ref** 
  ----------------------------------------- ----------
  Licensify LicenseSource implementation    5.9.1 

  Feature flag for source swap              5.9.2 

  Verification/sync job                     5.9.3 
  ----------------------------------------------------

 

**7. Risks & Mitigations** 

**R1: Revenue Impact of Default \$0 Budgets (HIGH)** 

**Risk:** Default \$0 targetAmount budgets mean users can only consume
included AIUs from the pool. Once the pool is exhausted, users are
blocked. **No paid premium request revenue will be generated**for
customers on default budgets. This is directly counter to last year\'s
revenue goals. 

**Mitigation:** 

- This decision must be explicitly communicated to revenue stakeholders
  (Jamie Jones, Radu) via the decision log. 

<!-- -->

- Soft limit budgets (5.6) provide an alternative where usage is tracked
  but not blocked, preserving revenue. 

<!-- -->

- Admins can raise targetAmount above \$0 to allow paid usage. 

**R2: License Count Sync Drift (HIGH)** 

**Risk:** If license counts become out of sync between billing platform
and the source of truth (Copilot DB / Licensify), customers may receive
incorrect credits. 

**Mitigation:** 

- High watermark tracking prevents mid-month pool shrinkage. 

<!-- -->

- lastKnownLicenseCount on customer object is updated on every license
  change event. 

<!-- -->

- Regular verification/sync job (5.9.3) will catch and alert on drift
  once Licensify is available. 

<!-- -->

- Provisional → confirmed flow on first emission catches month-boundary
  drift. 

**R3: Concurrency Under Burst Load (MEDIUM)** 

**Risk:** Multiple usage events for the same customer arriving
simultaneously could cause race conditions in pool consumption or budget
state updates. 

**Mitigation:** 

- Optimistic concurrency with etag-based conditional writes and retry. 

<!-- -->

- Pre-created provisional containers eliminate the \"no discount exists
  yet\" race. 

<!-- -->

- Load testing (5.8.4) will validate behavior under burst conditions. 

**R4: Scalability of Default Budget Creation (MEDIUM)** 

**Risk:** Creating MultiUserCustomer budgets for all users in all
org/enterprise Copilot customers is a significantly larger scale
than previous default budget transitions. Previous slowdowns
were observed with customer-level defaults. 

**Mitigation:** 

- Capacity investigation (5.8.1) before transition. 

<!-- -->

- Potential dedicated Cosmos container for budget state (5.8.2). 

<!-- -->

- Transition can be spread over multiple days if needed, with
  enforcement gated by feature flag. 

**R5: Scope Creep & Timeline (HIGH)** 

**Risk:** The scope of token-based billing changes continues to expand.
The June 1st GA target for all of Phases 2-5 is aggressive given the
breadth of changes. 

**Mitigation:** 

- This ADR provides a clear, prioritized scope. Changes should be
  evaluated against this scope, and new additions should trigger a
  timeline reassessment. 

<!-- -->

- Honest effort estimates (to be filled in) will surface timeline
  pressure early. 

**R6: Breaking Behavioral Change for Existing Customers (HIGH)** 

**Risk:** On June 1st, existing org/enterprise Copilot users who
previously had no budget limits will suddenly be capped at their
included AIU amount. This could disrupt active users. 

**Mitigation:** 

- Clear communication plan for affected customers. 

<!-- -->

- Soft limit budgets as a gentler alternative. 

<!-- -->

- \"Hard cut\" approach (per Holly\'s guidance) with hand-holding for
  transitioning customers. 

<!-- -->

- Budgets created ahead of June 1st but not enforced until the date
  (feature flag gating). 

**R7: Copilot Emission Delays (MEDIUM)** 

**Risk:** Copilot license change emissions can have up to a 3-hour
delay. This means mid-month pool recalculation may lag behind actual
license changes. 

**Mitigation:** 

- Acceptable for MVP; delay will be resolved when Copilot migrates
  to Licensify (near real-time). 

<!-- -->

- Credits are retroactively applied when the emission arrives, so
  customers are not permanently undercharged. 

 

**8. Open Questions** 

  -----------------------------------------------------------------------
  **\#**    **Question**                     **Owner**      **Status** 
  --------- -------------------------------- -------------- -------------
  Q1        What are the final included AIU  Copilot /      Open 
            amounts per SKU? (Currently      Product        
            using 300 CB / 1000 CE                          
            as placeholders.)                               

  Q2        Should discountAmount tracking   Product /      Open 
            extend to enterprise-level       Holly          
            budgets or other budget types                   
            beyond MultiUserCustomer?                       

  Q3        Will CFI onboard to Licensify?   Licensify /    Open 
            If so, what is the timeline?     Copilot        
            This determines whether we need                 
            two data sources long-term.                     

  Q4        What is the exact schema for     Copilot        Open 
            the is_removed_license event? Is / Licensify    
            it a separate event or a field                  
            on the existing emission?                       

  Q5        For the default \$0 budget       Product /      Open 
            transition, do we create budgets Holly          
            for ALL users or only users with                
            active Copilot seats?                           

  Q6        Revenue stakeholder sign-off on  Holly          Pending 
            \$0 default budgets (Jamie                      
            Jones, Radu --- Holly presenting                
            Friday).                                        

  Q7        Is there a maximum acceptable    Engineering    Open 
            latency                                         
            for LicenseSource queries during                
            usage processing? If the Copilot                
            Read-Only DB is slow, it                        
            blocks usageingestion.                          

  Q8        Will the limiter team continue   Enginering     Open 
            to be trackingentitlements for                  
            Copilot for Individuals?                        
            If so we can remove that phase                  
            and need to keep our                            
            billable/non-billable logic                     
  -----------------------------------------------------------------------

 

**9. Out of Scope** 

  ----------------------------------------------------
  **Item**                     **Reason** 
  ---------------------------- -----------------------
  CFI session windows / 5-hour This is a rate limit,
  rate limits                  not a billing concern. 

  Copilot Ultra                Separate workstream. 

  Licensify shadow/dual-read   Licensing team\'s
  validation                   responsibility. 
  ----------------------------------------------------

 

**10. References** 

- [[Original Copilot/Billing License Integration ADR (colleague\'s
  draft)]{.underline}](https://onedrive.cloud.microsoft/:w:/a@q2b7zy78/r/_layouts/15/Doc.aspx?sourcedoc=%7B2DBDBD47-42B4-4CB9-8E5E-EFF30562FF28%7D&file=Copilot-Billing%20license%20integration.docx&action=default&mobileredirect=true&DefaultItemOpen=1&ocdi=noRedirect) 

<!-- -->

- Billing ADR --- Copilot for Individuals (billing_copilot_cfi.md) 

<!-- -->

- Existing plan discount implementation in billing-platform 

<!-- -->

- [[skulist.json configuration
  patterns]{.underline}](https://github.com/github/billing-platform/blob/main/lib/engines/data/SkuList.json) 

<!-- -->

- MultiUserCustomer budget implementation 

<!-- -->

- Cosmos DB optimistic concurrency patterns 
