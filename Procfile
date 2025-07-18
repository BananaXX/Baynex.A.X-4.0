# Procfile for BAYNEX.A.X deployment
# This file tells the deployment platform how to run the application

# Main web process
web: node server.js

# Worker process for background tasks (optional)
worker: node src/workers/background-worker.js

# Release process (runs before deployment)
release: npm run setup && npm run migrate

# Clock process for scheduled tasks (optional)
clock: node src/workers/scheduler.js
