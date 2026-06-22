"""A static list of common interests used for onboarding suggestions and the
type-ahead autocomplete in the UI.

Each entry has a display ``name`` and a few ``keywords`` that sharpen what the
feed pulls in for that topic. This is just curated data - no logic - so the
frontend can show clickable chips and an autocomplete list without every user
having to think up topics from scratch.
"""

COMMON_INTERESTS = [
    # technology
    {"name": "Artificial Intelligence", "keywords": ["ai", "machine learning", "deep learning"]},
    {"name": "Machine Learning", "keywords": ["ml", "models", "training"]},
    {"name": "Programming", "keywords": ["coding", "software", "developer"]},
    {"name": "Cybersecurity", "keywords": ["security", "hacking", "privacy"]},
    {"name": "Startups", "keywords": ["startup", "founder", "venture capital"]},
    {"name": "Gadgets", "keywords": ["devices", "hardware", "reviews"]},
    {"name": "Smartphones", "keywords": ["phone", "android", "iphone"]},
    {"name": "Open Source", "keywords": ["open source", "github", "linux"]},
    {"name": "Cloud Computing", "keywords": ["cloud", "aws", "azure"]},
    {"name": "Web Development", "keywords": ["web", "javascript", "frontend"]},
    {"name": "Data Science", "keywords": ["data", "analytics", "statistics"]},
    {"name": "Robotics", "keywords": ["robots", "automation", "drones"]},
    {"name": "Cryptocurrency", "keywords": ["crypto", "bitcoin", "blockchain"]},
    {"name": "Gaming", "keywords": ["games", "esports", "console"]},
    {"name": "Virtual Reality", "keywords": ["vr", "ar", "metaverse"]},

    # science
    {"name": "Space", "keywords": ["space", "nasa", "astronomy"]},
    {"name": "Physics", "keywords": ["physics", "quantum", "particles"]},
    {"name": "Biology", "keywords": ["biology", "genetics", "cells"]},
    {"name": "Chemistry", "keywords": ["chemistry", "molecules", "materials"]},
    {"name": "Climate Change", "keywords": ["climate", "global warming", "emissions"]},
    {"name": "Environment", "keywords": ["environment", "nature", "conservation"]},
    {"name": "Neuroscience", "keywords": ["brain", "neurons", "cognition"]},
    {"name": "Medicine", "keywords": ["medicine", "health", "disease"]},
    {"name": "Psychology", "keywords": ["psychology", "behaviour", "mind"]},
    {"name": "Mathematics", "keywords": ["math", "mathematics", "geometry"]},

    # world / society
    {"name": "World News", "keywords": ["world", "international", "global"]},
    {"name": "Politics", "keywords": ["politics", "government", "election"]},
    {"name": "Economics", "keywords": ["economy", "inflation", "markets"]},
    {"name": "Business", "keywords": ["business", "companies", "industry"]},
    {"name": "Finance", "keywords": ["finance", "stocks", "investing"]},
    {"name": "Law", "keywords": ["law", "legal", "courts"]},
    {"name": "Education", "keywords": ["education", "schools", "learning"]},
    {"name": "History", "keywords": ["history", "historical", "ancient"]},
    {"name": "Philosophy", "keywords": ["philosophy", "ethics", "logic"]},
    {"name": "Energy", "keywords": ["energy", "renewable", "solar"]},

    # health / lifestyle
    {"name": "Fitness", "keywords": ["fitness", "exercise", "workout"]},
    {"name": "Nutrition", "keywords": ["nutrition", "diet", "food"]},
    {"name": "Mental Health", "keywords": ["mental health", "wellbeing", "stress"]},
    {"name": "Cooking", "keywords": ["cooking", "recipes", "food"]},
    {"name": "Travel", "keywords": ["travel", "tourism", "destinations"]},
    {"name": "Fashion", "keywords": ["fashion", "style", "clothing"]},
    {"name": "Photography", "keywords": ["photography", "cameras", "photos"]},
    {"name": "Productivity", "keywords": ["productivity", "habits", "focus"]},
    {"name": "Parenting", "keywords": ["parenting", "kids", "family"]},
    {"name": "Personal Finance", "keywords": ["budget", "savings", "money"]},

    # arts / entertainment
    {"name": "Movies", "keywords": ["movies", "film", "cinema"]},
    {"name": "Music", "keywords": ["music", "albums", "artists"]},
    {"name": "Books", "keywords": ["books", "reading", "literature"]},
    {"name": "Television", "keywords": ["tv", "series", "streaming"]},
    {"name": "Art", "keywords": ["art", "painting", "design"]},
    {"name": "Theatre", "keywords": ["theatre", "stage", "drama"]},
    {"name": "Anime", "keywords": ["anime", "manga", "japan"]},
    {"name": "Comics", "keywords": ["comics", "graphic novels", "superheroes"]},
    {"name": "Podcasts", "keywords": ["podcasts", "audio", "shows"]},

    # sports
    {"name": "Football", "keywords": ["football", "soccer", "league"]},
    {"name": "Basketball", "keywords": ["basketball", "nba", "hoops"]},
    {"name": "Tennis", "keywords": ["tennis", "grand slam", "atp"]},
    {"name": "Formula 1", "keywords": ["f1", "formula 1", "racing"]},
    {"name": "Cycling", "keywords": ["cycling", "bikes", "tour"]},
    {"name": "Running", "keywords": ["running", "marathon", "athletics"]},
    {"name": "Esports", "keywords": ["esports", "gaming", "tournaments"]},
    {"name": "Olympics", "keywords": ["olympics", "games", "athletes"]},

    # tech industry / specific
    {"name": "Electric Vehicles", "keywords": ["ev", "electric cars", "tesla"]},
    {"name": "Space Exploration", "keywords": ["spacex", "rockets", "mars"]},
    {"name": "Biotech", "keywords": ["biotech", "genomics", "pharma"]},
    {"name": "Quantum Computing", "keywords": ["quantum", "qubits", "computing"]},
    {"name": "Renewable Energy", "keywords": ["renewable", "wind", "solar"]},
    {"name": "Social Media", "keywords": ["social media", "platforms", "creators"]},
]
