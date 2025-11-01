// Cypress E2E Test for events.webmobi.com
// Test File: cypress/e2e/test-event.cy.js

describe('Event Creation Workflow - events.webmobi.com', () => {
  
  // Configuration
  const baseUrl = 'https://events.webmobi.com';
  const testEmail = 'test@example.com'; // Mock email for testing
  const testPassword = 'TestPassword123!'; // Mock password - NOT real credentials

  beforeEach(() => {
    // Clear cookies and local storage before each test
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  // TEST 1: Homepage loads successfully
  it('Should load the homepage successfully', () => {
    cy.visit(baseUrl);
    cy.url().should('include', 'events.webmobi.com');
    cy.title().should('exist');
    
    // Verify the login button is visible
    cy.get('button').contains('Login').should('be.visible');
  });

  // TEST 2: Login page elements are visible
  it('Should display login page with all required elements', () => {
    cy.visit(`${baseUrl}/auth/login`);
    
    // Check if email input exists
    cy.get('input#email')
      .should('be.visible')
      .and('have.attr', 'type', 'email')
      .and('have.attr', 'placeholder', 'you@example.com');
    
    // Check if password input exists
    cy.get('input#password')
      .should('be.visible')
      .and('have.attr', 'type', 'password');
    
    // Check if login button exists
    cy.get('button[type="submit"]').should('be.visible');
  });

  // TEST 3: User Login Flow (Manual - requires valid credentials)
  it('Should attempt login and handle authentication', () => {
    cy.visit(`${baseUrl}/auth/login`);
    
    // Fill in email
    cy.get('input#email').clear().type(testEmail);
    
    // Fill in password
    cy.get('input#password').clear().type(testPassword);
    
    // Intercept the login API call
    cy.intercept('POST', '**/auth/login').as('loginRequest');
    
    // Click login button
    cy.get('button[type="submit"]').click();
    
    // Wait for login response
    cy.wait('@loginRequest', { timeout: 10000 }).then((interception) => {
      if (interception.response) {
        cy.log('Login Response Status:', interception.response.statusCode);
        
        // If login successful, should redirect to dashboard
        if (interception.response.statusCode === 200) {
          cy.url().should('include', '/dashboard');
        }
      }
    });
  });

  // TEST 4: Dashboard access and authentication check
  it('Should check dashboard authentication requirements', () => {
    // Try to access dashboard without login
    cy.visit(`${baseUrl}/dashboard`, { failOnStatusCode: false });
    
    // Should either redirect to login or show 401 error
    cy.url().then((url) => {
      if (url.includes('/auth/login')) {
        cy.log('Correctly redirected to login page');
      } else {
        cy.log('Dashboard loaded - checking for auth errors');
      }
    });
  });

  // TEST 5: API Testing - GET /api/auth/me (Authentication Check)
  it('Should test GET /api/auth/me endpoint without authentication', () => {
    cy.request({
      method: 'GET',
      url: `${baseUrl}/api/auth/me`,
      failOnStatusCode: false
    }).then((response) => {
      // Should return 401 Unauthorized without auth token
      expect(response.status).to.eq(401);
      cy.log('API correctly returns 401 for unauthenticated request');
    });
  });

  // TEST 6: API Testing - GET /api/credits/balance
  it('Should test GET /api/credits/balance endpoint without authentication', () => {
    cy.request({
      method: 'GET',
      url: `${baseUrl}/api/credits/balance`,
      failOnStatusCode: false
    }).then((response) => {
      // Should return 401 Unauthorized
      expect(response.status).to.eq(401);
      expect(response.body).to.exist;
      cy.log('Credits API correctly requires authentication');
    });
  });

  // TEST 7: Create Event Page Navigation (with mock)
  it('Should navigate to create event page', () => {
    // Mock authentication for this test
    cy.intercept('GET', '**/api/auth/me', {
      statusCode: 200,
      body: {
        id: 'test-user-123',
        email: testEmail,
        name: 'Test User'
      }
    }).as('authCheck');

    cy.visit(`${baseUrl}/dashboard/create`);
    
    // Check if create page loaded
    cy.url().should('include', '/dashboard/create');
  });

  // TEST 8: Mock Event Creation with AI Chat Interface
  it('Should test event creation flow with mocked APIs', () => {
    // Mock authentication
    cy.intercept('GET', '**/api/auth/me', {
      statusCode: 200,
      body: {
        id: 'test-user-123',
        email: testEmail,
        name: 'Test User'
      }
    });

    // Mock credits balance
    cy.intercept('GET', '**/api/credits/balance', {
      statusCode: 200,
      body: {
        balance: 100,
        currency: 'USD'
      }
    });

    // Mock event creation API
    cy.intercept('POST', '**/api/events/**', {
      statusCode: 201,
      body: {
        id: 'event-12345',
        name: 'Cypress Test Event',
        status: 'created',
        message: 'Event created successfully'
      }
    }).as('createEvent');

    cy.visit(`${baseUrl}/dashboard/create`);
    
    // Since it's a chat interface, we'll look for input elements
    // Note: Adjust selectors based on actual chat interface structure
    cy.get('textarea, input[type="text"]').first().then(($input) => {
      if ($input.length) {
        cy.wrap($input)
          .type('Create a tech conference event for December 2025{enter}');
        
        cy.log('Sent message to AI chat interface');
      }
    });
  });

  // TEST 9: Form Validation Tests
  it('Should validate required fields on login form', () => {
    cy.visit(`${baseUrl}/auth/login`);
    
    // Try to submit without filling fields
    cy.get('button[type="submit"]').click();
    
    // Check for HTML5 validation
    cy.get('input#email').then(($input) => {
      expect($input[0].validationMessage).to.exist;
    });
  });

  // TEST 10: API Error Handling - Test 400 Bad Request
  it('Should handle POST requests with invalid data (400)', () => {
    cy.request({
      method: 'POST',
      url: `${baseUrl}/auth/login`,
      body: {
        email: 'invalid-email-format',
        password: '123' // Too short
      },
      failOnStatusCode: false
    }).then((response) => {
      // Should return 400 or 422 for validation errors
      expect([400, 401, 422]).to.include(response.status);
      cy.log(`API returned ${response.status} for invalid data`);
    });
  });

  // TEST 11: API Error Handling - Test 401 Unauthorized
  it('Should return 401 for protected endpoints without auth', () => {
    cy.request({
      method: 'GET',
      url: `${baseUrl}/api/events`,
      failOnStatusCode: false
    }).then((response) => {
      // Should return 401 Unauthorized
      expect(response.status).to.eq(401);
      cy.log('Protected endpoint correctly returns 401');
    });
  });

  // TEST 12: Navigation Menu Elements
  it('Should verify dashboard navigation menu exists', () => {
    // Mock authentication
    cy.intercept('GET', '**/api/auth/me', {
      statusCode: 200,
      body: { id: '123', email: testEmail }
    });

    cy.visit(`${baseUrl}/dashboard`);
    
    // Check for navigation menu
    cy.get('nav, aside').should('exist');
    
    // Check for create event link
    cy.get('a[href*="/dashboard/create"]').should('exist');
  });

  // TEST 13: Responsive Design Check
  it('Should be responsive on mobile viewport', () => {
    cy.viewport('iphone-x');
    cy.visit(baseUrl);
    
    // Check if page loads on mobile
    cy.get('body').should('be.visible');
    cy.get('button').contains('Login').should('be.visible');
  });

  // TEST 14: API Response Structure Validation
  it('Should validate API response structure for /api/auth/me', () => {
    // This test will fail with 401, but we can check the response structure
    cy.request({
      method: 'GET',
      url: `${baseUrl}/api/auth/me`,
      failOnStatusCode: false
    }).then((response) => {
      expect(response).to.have.property('status');
      expect(response).to.have.property('body');
      expect(response.headers).to.have.property('content-type');
      
      // Check content-type is JSON
      expect(response.headers['content-type']).to.include('application/json');
    });
  });

  // TEST 15: Session Management
  it('Should handle session/cookie management', () => {
    cy.visit(`${baseUrl}/auth/login`);
    
    // Check if cookies are set
    cy.getCookies().then((cookies) => {
      cy.log('Cookies found:', cookies.length);
    });
  });

  // TEST 16: Error Messages Display
  it('Should display error messages on failed login', () => {
    cy.visit(`${baseUrl}/auth/login`);
    
    // Try login with wrong credentials
    cy.get('input#email').type('wrong@email.com');
    cy.get('input#password').type('wrongpassword');
    
    cy.intercept('POST', '**/auth/login').as('loginAttempt');
    
    cy.get('button[type="submit"]').click();
    
    cy.wait('@loginAttempt').then((interception) => {
      if (interception.response && interception.response.statusCode !== 200) {
        // Look for error message in UI
        cy.get('body').should('contain.text', /error|invalid|failed/i);
      }
    });
  });

  // TEST 17: Signup Page Exists
  it('Should verify signup page is accessible', () => {
    cy.visit(`${baseUrl}/auth/signup`);
    cy.url().should('include', '/auth/signup');
    
    // Check for signup form elements
    cy.get('input[type="email"]').should('exist');
    cy.get('input[type="password"]').should('exist');
  });

  // TEST 18: API Headers Check
  it('Should verify API responses have correct headers', () => {
    cy.request({
      method: 'GET',
      url: `${baseUrl}/api/auth/me`,
      failOnStatusCode: false
    }).then((response) => {
      // Check for security headers
      expect(response.headers).to.exist;
      expect(response.headers['content-type']).to.include('json');
      
      cy.log('Response headers verified');
    });
  });

  // TEST 19: Multiple API Endpoints Status Check
  it('Should check status of multiple API endpoints', () => {
    const endpoints = [
      '/api/auth/me',
      '/api/credits/balance',
      '/api/events'
    ];

    endpoints.forEach((endpoint) => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}${endpoint}`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 401, 403, 404]);
        cy.log(`${endpoint}: ${response.status}`);
      });
    });
  });

  // TEST 20: Performance - Page Load Time
  it('Should load homepage within acceptable time', () => {
    const startTime = Date.now();
    
    cy.visit(baseUrl).then(() => {
      const loadTime = Date.now() - startTime;
      cy.log(`Page loaded in ${loadTime}ms`);
      
      // Assert page loads in less than 5 seconds
      expect(loadTime).to.be.lessThan(5000);
    });
  });
});