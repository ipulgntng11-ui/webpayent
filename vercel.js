{
  "version": 2,
  "name": "payment-gateway",
  "builds": [
    {
      "src": "*.js",
      "use": "@vercel/node"
    },
    {
      "src": "*.html",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs https://khafatopup.my.id; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://khafatopup.my.id; connect-src 'self' https://khafatopup.my.id;"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}