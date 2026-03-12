CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_courses (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  course_id INT REFERENCES courses(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  transaction_id TEXT,
  amount NUMERIC,
  status TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);