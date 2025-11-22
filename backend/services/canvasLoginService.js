import fetch from 'node-fetch';
import { load } from 'cheerio';

// Note: This is a workaround - Canvas doesn't officially support password-based API access
// This uses Canvas login page to get session cookies, then uses those cookies for API calls

let sessionCookies = null;

export async function loginWithPassword(canvasUrl, email, password) {
  try {
    console.log('🔐 Attempting Canvas login...');
    console.log(`📍 Canvas URL: ${canvasUrl}`);
    console.log(`👤 Login ID: ${email.substring(0, 3)}***`);
    
    // Step 1: Try multiple login endpoints to find one that works
    const loginEndpoints = [
      '/login/canvas',
      '/login',
      '/login/ldap',
      '/login/saml'
    ];
    
    let loginPageHtml = '';
    let cookies = '';
    let csrfToken = null;
    let workingEndpoint = '';
    
    console.log('📥 Fetching login page...');
    
    for (const endpoint of loginEndpoints) {
      try {
        console.log(`🔍 Trying endpoint: ${endpoint}`);
        const loginPageResponse = await fetch(`${canvasUrl}${endpoint}`, {
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        
        console.log(`📊 Status for ${endpoint}: ${loginPageResponse.status}`);
        
        if (loginPageResponse.status === 200 || loginPageResponse.status === 302) {
          // Extract cookies from response
          const setCookieHeaders = loginPageResponse.headers.get('set-cookie');
          if (setCookieHeaders) {
            cookies = setCookieHeaders.split(',').map(c => c.split(';')[0].trim()).filter(c => c).join('; ');
          }
          
          loginPageHtml = await loginPageResponse.text();
          console.log(`📄 HTML length: ${loginPageHtml.length}`);
          
          // Try to extract CSRF token using multiple methods
          // Method 1: Using Cheerio (more reliable HTML parsing)
          try {
            const $ = load(loginPageHtml);
            
            // Try different selectors
            const tokenSelectors = [
              'input[name="authenticity_token"]',
              'input[name=\'authenticity_token\']',
              'meta[name="csrf-token"]',
              'meta[name="csrf_token"]',
              '[name="authenticity_token"]'
            ];
            
            for (const selector of tokenSelectors) {
              const element = $(selector);
              if (element.length > 0) {
                csrfToken = element.attr('value') || element.attr('content');
                if (csrfToken) {
                  console.log(`✅ Found CSRF token using selector: ${selector} (length: ${csrfToken.length})`);
                  workingEndpoint = endpoint;
                  break;
                }
              }
            }
          } catch (cheerioError) {
            console.log('⚠️  Cheerio parsing failed, trying regex...');
          }
          
          // Method 2: Regex patterns (fallback)
          if (!csrfToken) {
            const csrfPatterns = [
              /name=["']authenticity_token["']\s+value=["']([^"']+)["']/i,
              /name=["']authenticity_token["']\s+value=["']([^"']+)["']/i,
              /authenticity_token["']?\s*[:=]\s*["']([^"']+)["']/i,
              /"authenticity_token"\s*:\s*"([^"]+)"/i,
              /'authenticity_token'\s*:\s*'([^']+)'/i,
              /csrf[_-]?token["']?\s*[:=]\s*["']([^"']+)["']/i,
              /<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i
            ];
            
            for (const pattern of csrfPatterns) {
              const match = loginPageHtml.match(pattern);
              if (match && match[1]) {
                csrfToken = match[1];
                console.log(`✅ Found CSRF token using regex (length: ${csrfToken.length})`);
                workingEndpoint = endpoint;
                break;
              }
            }
          }
          
          if (csrfToken) {
            break; // Found token, stop trying other endpoints
          }
        }
      } catch (endpointError) {
        console.log(`⚠️  Endpoint ${endpoint} failed: ${endpointError.message}`);
        continue;
      }
    }
    
    if (!csrfToken) {
      console.error('❌ Could not find CSRF token on any login endpoint');
      // Check if page has CAPTCHA
      if (loginPageHtml.includes('captcha') || loginPageHtml.includes('CAPTCHA') || loginPageHtml.includes('recaptcha') || loginPageHtml.includes('g-recaptcha')) {
        throw new Error('Canvas requires CAPTCHA verification. Password login is not available. Please use an access token instead. Go to Canvas Settings → Approved Integrations to create one.');
      }
      
      // Save a snippet of the HTML for debugging
      const htmlSnippet = loginPageHtml.substring(0, 2000);
      console.error('📄 HTML snippet (first 2000 chars):', htmlSnippet);
      
      throw new Error('Could not find CSRF token on login page. Canvas login structure may be different. Please try using an access token instead (Canvas Settings → Approved Integrations).');
    }
    
    console.log(`🍪 Initial cookies: ${cookies ? 'Found' : 'None'}`);
    
    // Step 2: Submit login form
    console.log(`📤 Submitting login form to: ${workingEndpoint}`);
    const loginResponse = await fetch(`${canvasUrl}${workingEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${canvasUrl}${workingEndpoint}`,
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': canvasUrl,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      body: new URLSearchParams({
        'pseudonym_session[unique_id]': email, // Canvas accepts username, email, or student ID here
        'pseudonym_session[password]': password,
        'authenticity_token': csrfToken,
      }),
      redirect: 'manual',
    });
    
    console.log(`📊 Login response status: ${loginResponse.status}`);
    
    // Get new cookies from login response
    const loginSetCookie = loginResponse.headers.get('set-cookie');
    if (loginSetCookie) {
      sessionCookies = loginSetCookie.split(',').map(c => c.split(';')[0].trim()).join('; ');
      console.log(`🍪 Session cookies: ${sessionCookies ? 'Found' : 'None'}`);
    }
    
    // Step 3: Check if login was successful
    const location = loginResponse.headers.get('location') || '';
    const status = loginResponse.status;
    
    console.log(`📍 Redirect location: ${location || 'None'}`);
    
    // Check response body for error messages
    let errorMessage = null;
    try {
      const responseText = await loginResponse.text();
      if (responseText.includes('Invalid') || responseText.includes('incorrect') || responseText.includes('wrong password')) {
        errorMessage = 'Invalid username/email or password. Please check your credentials.';
      } else if (responseText.includes('captcha') || responseText.includes('CAPTCHA')) {
        errorMessage = 'Canvas requires CAPTCHA verification. Password login is not available. Please use an access token instead.';
      } else if (responseText.includes('locked') || responseText.includes('suspended')) {
        errorMessage = 'Account may be locked or suspended. Please contact your Canvas administrator.';
      }
    } catch (e) {
      // Ignore
    }
    
    if (status === 302 && location && !location.includes('/login')) {
      console.log('✅ Login redirect successful!');
      
      // Follow redirect to get final session cookies
      try {
        const redirectUrl = location.startsWith('http') ? location : `${canvasUrl}${location}`;
        console.log(`🔄 Following redirect to: ${redirectUrl}`);
        const redirectResponse = await fetch(redirectUrl, {
          redirect: 'manual',
          headers: {
            'Cookie': sessionCookies || cookies,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const redirectCookies = redirectResponse.headers.get('set-cookie');
        if (redirectCookies) {
          const newCookies = redirectCookies.split(',').map(c => c.split(';')[0].trim()).filter(c => c);
          if (sessionCookies) {
            sessionCookies = sessionCookies + '; ' + newCookies.join('; ');
          } else {
            sessionCookies = newCookies.join('; ');
          }
        }
      } catch (e) {
        console.log('⚠️  Could not follow redirect, using existing cookies');
      }
      
      // Step 4: Get user info to verify
      console.log('🔍 Verifying login with API...');
      const userResponse = await fetch(`${canvasUrl}/api/v1/users/self`, {
        headers: {
          'Accept': 'application/json',
          'Cookie': sessionCookies || cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log(`📊 API verification status: ${userResponse.status}`);
      
      if (userResponse.ok) {
        const user = await userResponse.json();
        console.log(`✅ Authenticated as: ${user.name} (${user.email || email})`);
        
        return {
          success: true,
          user: user,
          cookies: sessionCookies || cookies
        };
      } else {
        const errorText = await userResponse.text();
        console.error(`❌ API verification failed: ${userResponse.status} - ${errorText.substring(0, 100)}`);
        throw new Error(`Login appeared successful but API access failed (${userResponse.status}). Canvas may require an access token for API access.`);
      }
    } else {
      // Login failed
      console.error(`❌ Login failed - Status: ${status}, Location: ${location}`);
      throw new Error(errorMessage || 'Invalid username/email or password. Please check your credentials and try again.');
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    throw error;
  }
}

// Helper to make authenticated Canvas API requests using session cookies
export async function canvasRequestWithSession(cookies, canvasUrl, endpoint) {
  const url = `${canvasUrl}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Cookie': cookies
    }
  });
  
  if (!response.ok) {
    throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

