# Backend validation

2026-11-24: dedicated Leadory project provisioning rejected by Supabase because the owner has reached the two active free project limit. No existing projects were paused, altered or deleted. No remote migration was executed.

## Before applying SQL
- Confirm target project with owner. Prefer dedicated project; shared project requires isolated Leadory-prefixed tables, separate policies and collision review. Do not apply the original generic schema blindly to a shared project.
- Review schema and provider terms; do not import restricted source data.
- Apply migration only to approved target; verify table grants and RLS.

## Acceptance tests (pending remote database)
1. Authenticated user A creates a campaign and lead. User B cannot read or mutate either.
2. Anonymous access to leads/campaigns is denied.
3. Cross-owner campaign foreign key fails.
4. Radius 51 and limit 101 fail; score outside 0–100 fails.
5. Duplicate normalized phone per campaign fails; normalization must occur before insert.
6. Verify authenticated CRUD from frontend; do not use service-role credentials in browser.
7. Verify CRM stage changes, dashboard counts and campaign settings survive reload.
8. Verify messaging remains disabled until consent records, approved templates, opt-out enforcement and signed webhooks are implemented.
9. Run Supabase security advisors and review findings.

All live database tests are pending provisioning. No real leads or outbound messages were generated.
