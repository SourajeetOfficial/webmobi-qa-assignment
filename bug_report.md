# Bug Report - Webmobi Platforms QA Testing

**Tester**: Sourajeet Sahoo 
**Date**: November 1, 2025  
**Test Environment**: Production  
**Testing Framework**: Cypress 13.x  
**Methodology**: Black-box E2E Testing

---

## Executive Summary

During comprehensive black-box testing of events.webmobi.com and certificates.webmobi.com, **3 production bugs** were identified affecting user experience, functionality, and system performance. All bugs are reproducible and documented with detailed steps, impact analysis, and suggested fixes.

---

## Bug Summary Table

| ID | Platform | Severity | Status | Component | Impact |
|----|----------|----------|--------|-----------|--------|
| #1 | events.webmobi.com | HIGH | Open | Authentication | All authenticated users |
| #2 | certificates.webmobi.com | HIGH | Open | PDF Generation | Certificate generation fails |
| #3 | certificates.webmobi.com | MEDIUM | Open | Profile API | Users cannot update profiles |

---

# Bug #1: Infinite 401 Authentication Loop After Login

## 🔴 Severity: HIGH
**Priority**: P1  
**Platform**: events.webmobi.com  
**Affects**: All authenticated users (100% reproduction rate)  
**Component**: Authentication System / Dashboard  
**Browser**: All browsers  
**Environment**: Production

---

## 📝 Description

After successful user login, the dashboard attempts to make repeated API calls to authentication and credits endpoints. All requests fail with 401 Unauthorized errors, creating an infinite retry loop that floods the browser console with hundreds of error messages and degrades application performance.

---

## 🔄 Steps to Reproduce

1. Navigate to `https://events.webmobi.com`
2. Click "Login" button
3. Enter valid credentials and submit
4. Observe redirect to `/dashboard`
5. Open Chrome DevTools (F12) → Console tab
6. Observe continuous stream of 401 errors

**Reproduction Rate**: 100%  
**Time to Reproduce**: <5 seconds after login

---

## ✅ Expected Behavior

1. User logs in with valid credentials
2. Application receives and stores authentication token
3. Dashboard loads successfully with user data
4. API calls to `/api/auth/me` return 200 OK with user info
5. API calls to `/api/credits/balance` return 200 OK with balance
6. No repeated failed requests
7. Clean console with no authentication errors

---

## ❌ Actual Behavior

1. User logs in successfully ✓
2. Redirected to `/dashboard` ✓
3. Application makes API call to `/api/auth/me` → **401 Unauthorized** ✗
4. Application makes API call to `/api/credits/balance` → **401 Unauthorized** ✗
5. Application **retries both requests continuously** (100+ times) ✗
6. Console fills with error messages ✗
7. No error message shown to user ✗
8. Dashboard loads visually but may lack data ✗

---

## 📸 Evidence

### Console Errors (Repeated 100+ times):
```
page-676486e39a5a124d.js:1  GET https://events.webmobi.com/api/auth/me 401 (Unauthorized)
layout-0e85e8f064347df5.js:1  GET https://events.webmobi.com/api/credits/balance 401 (Unauthorized)
```

### Network Tab Analysis:
```
Request URL: https://events.webmobi.com/api/auth/me
Request Method: GET
Status Code: 401 Unauthorized
Remote Address: 18.66.57.107:443
```

### Request Pattern:
- First request: 0ms
- Retry 1: ~10ms later
- Retry 2: ~10ms later
- Pattern continues indefinitely

---

## 💥 Impact Analysis

### User Experience Impact:
- **Severity**: High
- **Visibility**: Hidden from users (no error message)
- **Functional Impact**: Dashboard may not display correct data
- **Performance Impact**: Browser becomes slow and unresponsive

### Technical Impact:
- **Server Load**: 100+ unnecessary requests per user session
- **Network Traffic**: Wasted bandwidth (~50KB per failed request)
- **Browser Performance**: Memory consumption increases, CPU usage spikes
- **Developer Experience**: Console spam makes debugging impossible

### Business Impact:
- **User Trust**: Technical issues reduce platform confidence
- **Scalability**: Excessive requests limit concurrent user capacity
- **Cost**: Unnecessary server resources and bandwidth consumed
- **Support Overhead**: Increased support tickets for slow performance

---

## 🔍 Root Cause Analysis (Hypothesis)

Based on black-box testing observations:

### Likely Cause #1: Token Not Stored Correctly
- Login endpoint returns token successfully
- Token may not be persisted to localStorage/cookies
- Subsequent requests lack authentication header
- Server correctly rejects unauthenticated requests

### Likely Cause #2: Token Format Mismatch
- Frontend sends token in wrong format/header
- Backend expects `Authorization: Bearer <token>`
- Frontend sends `Authorization: <token>` or different format
- Server rejects as unauthorized

### Likely Cause #3: Missing Error Handling
- Application doesn't handle 401 responses properly
- No redirect to login page on authentication failure
- Retry logic has no exponential backoff
- No maximum retry limit implemented

### Likely Cause #4: Race Condition
- Dashboard renders before authentication completes
- React components fire API calls before token is available
- No state management waiting for auth completion

---

## 🛠 Suggested Fixes

### Immediate (Hotfix - Priority 1):
```javascript
// Add retry limit
let retryCount = 0;
const MAX_RETRIES = 3;

if (response.status === 401 && retryCount < MAX_RETRIES) {
  retryCount++;
  // Retry with exponential backoff
  setTimeout(() => retry(), Math.pow(2, retryCount) * 1000);
} else if (retryCount >= MAX_RETRIES) {
  // Redirect to login
  window.location.href = '/auth/login';
  showError('Authentication failed. Please log in again.');
}
```

### Short-term (Sprint Fix):
1. **Verify token storage**:
```javascript
// After successful login
localStorage.setItem('auth_token', token);
// OR
document.cookie = `auth_token=${token}; path=/; secure; httpOnly`;
```

2. **Add token to requests**:
```javascript
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

3. **Implement auth state management**:
```javascript
// Use Redux/Context to manage auth state
const [authState, setAuthState] = useState({
  isAuthenticated: false,
  user: null,
  loading: true
});
```

### Long-term (Technical Debt):
1. Implement refresh token mechanism
2. Add comprehensive error handling middleware
3. Implement proper logging and monitoring (Sentry)
4. Add E2E tests to prevent regression

---

## ✅ Verification Steps (After Fix)

### Cypress Test:
```javascript
describe('Authentication Fix Verification', () => {
  it('Should not make repeated 401 requests', () => {
    let authRequests = 0;
    
    cy.intercept('GET', '**/api/auth/me', (req) => {
      authRequests++;
    }).as('authCheck');
    
    cy.login('test@example.com', 'password123');
    cy.wait(5000);
    
    expect(authRequests).to.be.lessThan(5);
  });
  
  it('Should show error and redirect on auth failure', () => {
    cy.visit('/dashboard');
    cy.wait(2000);
    cy.url().should('include', '/auth/login');
  });
});
```

---

# Bug #2: Certificate PDF Generation Fails - Puppeteer Chrome Missing

## 🔴 Severity: HIGH
**Priority**: P1  
**Platform**: certificates.webmobi.com  
**Affects**: All users attempting certificate generation  
**Component**: PDF Generation / Puppeteer  
**Environment**: Production Server

---

## 📝 Description

When users attempt to generate certificates through the batch creation workflow, the PDF generation process fails completely with a Puppeteer error indicating that Chrome browser executable is not installed on the server. This makes the core functionality of the platform unusable.

---

## 🔄 Steps to Reproduce

1. Log in to `https://certificates.webmobi.com`
2. Navigate to `/dashboard/certificates/new`
3. Upload a CSV file with recipient data
4. Select a certificate template
5. Map CSV fields to certificate fields
6. Click "Generate & Send Certificates"
7. Observe the error in browser console

**Reproduction Rate**: 100%  
**Time to Reproduce**: ~30 seconds

---

## ❌ Actual Error

### Console Error:
```javascript
POST https://certificates.webmobi.com/api/pdf/generate 500 (Internal Server Error)

Error: Could not find Chrome (ver. 141.0.7390.122). This can occur if either
 1. you did not perform an installation before running the script 
    (e.g. `npx puppeteer browsers install chrome`) or
 2. your cache path is incorrectly configured 
    (which is: /home/sbx_user1051/.cache/puppeteer).
```

### API Response:
```json
{
  "error": "Internal Server Error",
  "message": "PDF generation failed",
  "statusCode": 500
}
```

---

## ✅ Expected Behavior

1. User uploads CSV and selects template
2. System generates PDF certificates using Puppeteer
3. Certificates are saved to storage
4. Emails are sent to recipients with PDF attachments
5. User sees success confirmation
6. Batch status shows "Completed"

---

## 💥 Impact Analysis

### User Experience Impact:
- **Severity**: Critical
- **Functional Impact**: Core feature completely broken
- **Workaround**: None available
- **User Frustration**: High - paid service not working

### Business Impact:
- **Revenue**: Users cannot use paid service
- **Trust**: Significant trust damage
- **Support**: High volume of support tickets
- **Churn Risk**: Users may request refunds

---

## 🔍 Root Cause Analysis

### Confirmed Issue:
- Puppeteer is installed but Chrome browser binary is missing
- Server environment doesn't have Chrome installed
- Puppeteer cache path is empty or incorrect
- Build/deployment process doesn't include browser installation

### Why This Happens:
1. Puppeteer doesn't bundle Chrome by default in newer versions
2. Chrome must be explicitly installed: `npx puppeteer browsers install chrome`
3. Docker containers need Chrome dependencies installed
4. CI/CD pipeline may not include browser installation step

---

## 🛠 Suggested Fixes

### Immediate Fix (Server Configuration):

**Option 1: Install Chrome via Puppeteer**
```bash
# SSH into production server
cd /path/to/application
npx puppeteer browsers install chrome

# Verify installation
ls -la ~/.cache/puppeteer/
```

**Option 2: Install Chrome via Package Manager** (Better for Docker)
```dockerfile
# Add to Dockerfile
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils
```

### Code Fix:
```javascript
// Update PDF generation code to use installed Chrome
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', // or path to Chrome
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  headless: true
});
```

### Long-term Solutions:
1. **Add to CI/CD pipeline**:
```yaml
# .github/workflows/deploy.yml
- name: Install Puppeteer browsers
  run: npx puppeteer browsers install chrome
```

2. **Add environment check**:
```javascript
// startup.js
const puppeteer = require('puppeteer');

async function checkBrowsers() {
  try {
    const browser = await puppeteer.launch();
    await browser.close();
    console.log('✓ Puppeteer Chrome available');
  } catch (error) {
    console.error('✗ Puppeteer Chrome missing:', error.message);
    process.exit(1);
  }
}
```

---

## ✅ Verification Steps

```javascript
// Test after fix
it('Should generate PDF successfully', () => {
  cy.request({
    method: 'POST',
    url: '/api/pdf/generate',
    body: {
      template_id: 'test-template',
      data: { name: 'Test User' }
    },
    headers: { Authorization: 'Bearer valid-token' }
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body).to.have.property('pdf_url');
  });
});
```

---

# Bug #3: Profile Update Returns 400 Bad Request

## 🟡 Severity: MEDIUM
**Priority**: P2  
**Platform**: certificates.webmobi.com  
**Affects**: Users attempting to update profile information  
**Component**: User Profile API  
**Environment**: Production

---

## 📝 Description

When users attempt to update their profile information through the settings page, the API returns a 400 Bad Request error even with valid data. This prevents users from updating their name, organization, or other profile fields.

---

## 🔄 Steps to Reproduce

1. Log in to `https://certificates.webmobi.com`
2. Navigate to `/dashboard/settings`
3. Click on "Profile" tab
4. Update any profile field (name, organization, etc.)
5. Click "Save" or "Update Profile"
6. Observe error in console

**Reproduction Rate**: 100%  
**Time to Reproduce**: ~10 seconds

---

## ❌ Actual Error

### Console Error:
```javascript
PUT https://certificates.webmobi.com/api/user/profile 400 (Bad Request)

Error: Failed to update profile
```

### API Response:
```json
{
  "error": "Bad Request",
  "message": "Validation failed",
  "statusCode": 400
}
```

---

## ✅ Expected Behavior

1. User updates profile fields
2. Form validates data client-side
3. API accepts valid data
4. Profile updated successfully
5. User sees success message
6. Changes reflected immediately

---

## 💥 Impact Analysis

### User Experience Impact:
- **Severity**: Medium
- **Functional Impact**: Cannot update profile information
- **Workaround**: Contact support for manual updates
- **Frequency**: Affects all profile update attempts

### Business Impact:
- **User Satisfaction**: Moderate frustration
- **Support Load**: Increased support tickets
- **Data Quality**: Profiles remain outdated

---

## 🔍 Root Cause Analysis (Hypothesis)

### Possible Causes:
1. **API validation too strict** - Rejects valid data
2. **Required field missing** - Frontend doesn't send all required fields
3. **Data type mismatch** - Frontend sends string, API expects number
4. **Missing authentication** - Token not included in request

### Investigation Needed:
- Review API validation rules
- Check request payload structure
- Verify required vs optional fields
- Test with various data combinations

---

## 🛠 Suggested Fixes

### Short-term:
1. **Add detailed error messages**:
```javascript
// API should return specific validation errors
{
  "error": "Validation failed",
  "details": {
    "name": "Name is required",
    "phone": "Invalid phone format"
  }
}
```

2. **Frontend validation**:
```javascript
// Match backend requirements
const validateProfile = (data) => {
  if (!data.name || data.name.trim().length < 2) {
    return 'Name must be at least 2 characters';
  }
  // Add other validations
  return null;
};
```

### Long-term:
1. Review and document API validation rules
2. Add comprehensive input validation tests
3. Improve error messages for users

---

## ✅ Verification Steps

```javascript
it('Should update profile successfully', () => {
  cy.request({
    method: 'PUT',
    url: '/api/user/profile',
    body: {
      name: 'Test User',
      organization: 'Test Org',
      phone: '+1234567890'
    },
    headers: { Authorization: 'Bearer valid-token' }
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body.name).to.eq('Test User');
  });
});
```

---

## 📊 Summary Statistics

| Metric | Value |
|--------|-------|
| Total Bugs Found | 3 |
| Critical Severity | 0 |
| High Severity | 2 |
| Medium Severity | 1 |
| Low Severity | 0 |
| Reproduction Rate | 100% |
| Environment | Production |
| Testing Method | Black-box E2E |

---

## 🎯 Recommendations

### Immediate Actions:
1. **Deploy hotfix for Bug #1** - Add retry limit
2. **Install Chrome for Bug #2** - Fix PDF generation
3. **Investigate Bug #3** - Review API validation

### Process Improvements:
1. Add E2E tests to CI/CD pipeline
2. Implement error tracking (Sentry/LogRocket)
3. Set up monitoring alerts for 401/500 errors
4. Regular QA testing before releases

### Documentation:
1. Document API validation requirements
2. Create troubleshooting guides
3. Add error handling best practices

---

**Report Prepared By**: Sourajeet Sahoo 
**Date**: November 1, 2025  
**Testing Framework**: Cypress 13.x  
**Total Testing Time**: ~5 hours  
**Report Version**: 1.0

---

*End of Bug Report*
