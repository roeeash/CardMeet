#!/bin/bash
# Append or modify pg_hba.conf to allow password-based auth from all hosts
echo "Configuring PostgreSQL authentication..."

# The pg_hba.conf file should already exist when this runs during initdb
# We need to add an entry that allows password auth from all hosts
# This file is typically at /var/lib/postgresql/data/pg_hba.conf

# Wait for postgres to be initialized
sleep 5

# Append the configuration (the default trust/scram entries will be first)
echo "host    all             all             0.0.0.0/0               password" >> /var/lib/postgresql/data/pg_hba.conf

echo "PostgreSQL authentication configured"
