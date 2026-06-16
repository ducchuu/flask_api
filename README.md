# Pulse

Pulse is a personalised content feed web app. It pulls articles, videos and discussions from several public APIs, scores them against the topics a user cares about, and serves the result as a single ranked feed. The goal is to replace checking five different sites with one page that already knows what you are interested in, to save you time and surface update syou actually care about.

## Frontend mockup

// IMAGE OF THE REAL FRONTEND

## Features

- User accounts with sign up, login and a tunable profile.
- Interests: add the topics you follow, each with keywords and a weight.
- A combined feed built from GNews, YouTube and Lemmy.
- Relevance scoring that mixes keyword overlap, freshness, sentiment and source preference.
- Related items grouped into stories so the same event is not repeated.
- Collections so a user can save items into their own lists.
- Feedback (thumbs up/down) that the feed can learn from.
- Stats endpoint that counts how many items match each interest.

## Team members

- Isiah Ost
- Mikolaj Duchlinski
- Karina Kalicka-Molin
- Iain Correia

## Tech stack

- Python 3 and Flask for the backend.
- SQLite for storage (no separate database server to set up)
- requests for the API calls, vaderSentiment for sentiment scoring.
- pytest for the test suite

## Installation

*You need Python 3.11 or newer!*

```bash
# 1. clone and enter the project
git clone https://github.com/VU-Applied-Programming-for-AI-2026/group-28.git
cd group-28

# 2. create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate

# 3. install the dependencies
pip install -r requirements.txt

# 4. set up your environment file
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in the values. `SECRET_KEY` can be any long random
string. The API keys are only needed if you want live data. If you leave
`FIXTURE_MODE=1` the app runs on recorded sample data and needs no keys, which is
the easiest way to try it out.

## Running the app

```bash
flask --app "backend.app:create_app" run
```

The server starts on http://127.0.0.1:5000. Check that it is alive:

```bash
curl http://127.0.0.1:5000/api/health
# {"status": "ok"}
```

## Running the tests

```bash
pytest backend/
```

## API overview

All routes return JSON. Anything tied to a user needs a token from
`POST /api/tokens`.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/health` | Liveness check |
| POST | `/api/users` | Register a new user |
| POST | `/api/tokens` | Log in and get a token |
| GET/PATCH | `/api/users/me` | Read or update your profile |
| GET/POST | `/api/interests` | List or add interests |
| GET/PUT/DELETE | `/api/interests/<id>` | Read, edit or remove one interest |
| GET | `/api/items` | The ranked feed, with filters and sorting |
| GET | `/api/items/stats` | Item counts per interest |
| GET/POST | `/api/stories` | List or create stories |
| GET | `/api/stories/<id>` | One story and its items |
| GET/POST | `/api/collections` | List or create collections |
| PUT/DELETE | `/api/collections/<id>` | Edit or remove a collection |
| PUT/DELETE | `/api/collections/<id>/items/<id>` | Add or remove an item in a collection |
| GET/POST/DELETE | `/api/feedback` | Read, add or remove feedback |

## Architecture

The backend is a Flask app built with an application factory
(`create_app` in `backend/app.py`). Each feature is its own blueprint under
`backend/routes/`, and the heavier logic lives in `backend/services/`.

```
backend/
  app.py            application factory, config, error handling, health check
  auth.py           token signing and the login-required helper
  db.py             SQLite connection handling
  schema.sql        database tables
  models.py         data classes for users, items, interests and so on
  routes/           one file per feature (users, interests, feed, stories, ...)
  fetchers/         pull and normalise data from GNews, YouTube and Lemmy
  services/         the pipeline, scoring, enrichment, clustering and caching
  tests/            pytest suite
frontend/           frontend app
```

A request to the feed flows like this: the fetchers collect raw items from the external APIs, the pipeline normalises them into one shape, enrichment adds sentiment and other signals, scoring ranks each item against the user's interests, and clustering groups related items into stories before the route returns them.