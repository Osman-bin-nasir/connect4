#!/bin/bash

# This script deploys the server/ folder to the connect4-backend repository.
# IMPORTANT: Make sure you have committed your changes in the server/ folder before running this!

echo "Deploying the latest committed changes in server/ to backend..."
git subtree push --prefix server backend main
echo "Deployment complete!"
