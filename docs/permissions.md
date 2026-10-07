# Permissions

All services deny by default. Society membership is mandatory and checked on each request. Unknown IDs and unauthorized record IDs produce non-disclosing errors. Changing roles/settings/revoking grants takes effect on the next request. Production privileged roles require enrolled MFA and a completed Better Auth session.

| Capability                             | ADMIN       | CASHIER                     | RESIDENT                                        | SECURITY                  | AUDITOR                |
| -------------------------------------- | ----------- | --------------------------- | ----------------------------------------------- | ------------------------- | ---------------------- |
| Flat physical directory                | All         | All                         | Explicit active grants                          | Dedicated projection only | Denied                 |
| Operational names/approved phone       | All         | Active directory            | Own profile                                     | Only when enabled         | Denied                 |
| Ownership/occupancy history            | Read/write  | Denied                      | Denied                                          | Denied                    | Denied                 |
| Area/hierarchy/import                  | Read/write  | Denied                      | Denied                                          | Denied                    | Denied                 |
| Parking entitlement/allocation/vehicle | Read/write  | Read operational projection | Authorized flats, minimized                     | Optional enabled fields   | Denied                 |
| Profile                                | Own         | Own                         | Own                                             | Own                       | Own                    |
| Roles/security policy/access grants    | Read/write  | Denied                      | Denied                                          | Denied                    | Denied                 |
| Audit                                  | Read        | Denied                      | Denied                                          | Denied                    | Read, non-PII metadata |
| Private flat documents                 | Upload/read | Denied                      | Clean/shared + captured membership + live grant | Denied                    | Denied                 |
| Host backup status                     | Read        | Denied                      | Denied                                          | Denied                    | Denied                 |
| Future financial functionality         | Planned     | Planned                     | Granted accounts only                           | Denied                    | Planned read-only      |

Security's service selects only resident name, approved phone, phase/block/flat; optional vehicle registration/type/color/slot. It does not load email, internal notes, area, legal history or finance fields and then redact. Access and rate-limit checks happen before lookup. Every successful lookup is audited without search text.

Resident DTOs exclude other persons, internal remarks, ownership and occupancy history. Grants must be live, unrevoked and within their date interval. If linked to occupancy, occupancy must also be current. Occupancy end revokes linked grants atomically. Personal profile updates never update membership roles or legal records. Historical financial documents will require their own explicit grant and snapshot payer authorization; a new occupant does not inherit them.

Admin may manage business master data, but not edit/delete audit evidence. Membership changes forbid removing/demoting the last active admin and disable stale sessions' permissions immediately. There is no financial mark-paid control in this stage.
