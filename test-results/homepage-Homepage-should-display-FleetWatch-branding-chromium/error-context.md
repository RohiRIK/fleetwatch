# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]: FleetWatch
      - generic [ref=e6]: Enterprise device fleet management powered by Microsoft Intune
    - generic [ref=e7]:
      - button "Sign in with Microsoft" [ref=e8]:
        - img
        - text: Sign in with Microsoft
      - generic [ref=e12]: Or continue with
      - link "Emergency Admin Login" [ref=e13] [cursor=pointer]:
        - /url: /admin-login
        - button "Emergency Admin Login" [ref=e14]
      - paragraph [ref=e15]: Emergency admin login should only be used when Azure AD is unavailable.
  - button "Open Next.js Dev Tools" [ref=e21] [cursor=pointer]:
    - img [ref=e22]
  - alert [ref=e25]
```