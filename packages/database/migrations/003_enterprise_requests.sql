CREATE TABLE enterprise_requests(id uuid PRIMARY KEY, email text NOT NULL, company text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(email,company));
