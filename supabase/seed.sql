-- WFSC seed: illustration styles, template categories, story templates.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Illustration styles (reference_image_urls filled once style packs are
-- uploaded to Supabase Storage under style-refs/<style-id>/)
-- ---------------------------------------------------------------------------
insert into styles (id, name, description, style_prompt, sort_order) values
(
  'flat-vector',
  'Sunny Paper Cut',
  'Bold flat shapes, thick friendly outlines and a warm limited palette — like the WFSC brand itself.',
  'flat vector naive children''s-book illustration, bold simple geometric shapes, thick uneven hand-drawn outlines, warm limited palette of coral red, marigold yellow, cobalt blue and sage green, subtle textured paper grain, cheerful rounded characters with rosy cheeks and dot eyes, no gradients, no photorealism, no text',
  1
),
(
  'watercolor',
  'Gentle Watercolor',
  'Soft washes, delicate linework and dreamy light — a classic bedtime storybook feel.',
  'gentle watercolor children''s-book illustration, soft translucent washes, delicate pencil linework, muted pastel palette with warm sunlight, visible paper texture, loose expressive brush strokes, tender storybook atmosphere, no hard outlines, no photorealism, no text',
  2
),
(
  'riso-print',
  'Riso Pop',
  'Playful screen-print look with grainy overlapping inks in a few punchy colors.',
  'risograph screen-print style children''s-book illustration, grainy overlapping ink layers, limited palette of fluorescent coral, teal blue and sunflower yellow, visible print misregistration, bold simplified shapes, flat perspective, retro playful energy, no gradients, no photorealism, no text',
  3
),
(
  'crayon',
  'Crayon Scribbles',
  'Waxy crayon strokes and wobbly lines, like the best drawing on the fridge.',
  'children''s crayon drawing style illustration, waxy textured crayon strokes, wobbly endearing hand-drawn lines, bright primary colors on warm off-white paper, visible scribble fills that escape the lines, childlike joyful energy, naive proportions, no photorealism, no text',
  4
),
(
  'mid-century',
  'Little Golden Vintage',
  'Mid-century picture-book charm: textured gouache, stylized characters, nostalgic colors.',
  'mid-century vintage children''s-book illustration, textured gouache paint, stylized rounded characters, nostalgic palette of mustard, dusty rose, teal and cream, subtle halftone shading, 1950s picture-book charm, slightly flattened perspective, no photorealism, no text',
  5
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  style_prompt = excluded.style_prompt,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Template categories (mirrors the brand's audience tiles)
-- ---------------------------------------------------------------------------
insert into template_categories (id, name, tagline, sort_order) values
('mums',         'Mums',            'Adventures with the one who knows you best.', 1),
('dads',         'Dads',            'Big laughs, small hands, unforgettable days.', 2),
('grandparents', 'Grandparents',    'Turn their wisdom and warmth into a keepsake.', 3),
('siblings',     'Siblings',        'Partners in crime, heroes of the same story.', 4),
('babies',       'Babies & Firsts', 'First steps, first words, first everything.', 5),
('kids',         'Kids'' Adventures', 'Everyday moments that felt like magic.', 6)
on conflict (id) do update set
  name = excluded.name, tagline = excluded.tagline, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Story templates
-- story_beats: ordered narrative skeleton; Claude expands into ~14 spreads and
-- weaves in the customer's actual memory details.
-- ---------------------------------------------------------------------------
insert into story_templates
  (id, category_id, title, tagline, description, suggested_style_id, story_beats, prompt_scaffold, cover_concept, sort_order)
values
(
  'day-at-the-zoo', 'grandparents',
  'Our Day at the Zoo',
  'A grand safari, two explorers, one unforgettable day.',
  'Relive a zoo visit as a grand expedition — every enclosure a new world, every animal a new friend.',
  'flat-vector',
  '["Waking up excited: today is zoo day", "The journey there feels like the start of an expedition", "First animal encounter: awe up close", "A funny animal moment that makes everyone laugh", "Snack break and people-watching together", "The favorite animal: a quiet, magical connection", "Getting a little lost (or pretending to be explorers)", "One more round: goodbye to the animals", "The sleepy ride home", "Retelling the adventure at bedtime: best day ever"]',
  'Tone: adventurous but cozy. Frame the pair as a little expedition team. Use the child''s real favorite animal if mentioned in the memory. End on togetherness, not the animals.',
  'The pair at the zoo gates at golden hour, favorite animal peeking from behind the title.',
  1
),
(
  'golf-with-grandpa', 'grandparents',
  'A Very Important Game',
  'Little caddie, big green, the best teammate in the world.',
  'A day on the golf course becomes a hero''s quest — carrying the clubs, chasing the ball, celebrating the putt.',
  'mid-century',
  '["Getting ready: tiny shoes, big clubs", "Arriving at the huge green world of the course", "The first swing: a very serious lesson", "The ball goes somewhere very silly", "A break: snacks and secrets in the golf cart", "Helping line up the big putt", "The ball rolls... and rolls... and drops in!", "Victory dance on the green", "Packing up as the sun gets low", "Home again: trophies are nice, but days like this are better"]',
  'Tone: gently funny, warm. The grown-up treats the child as a true teammate. Keep golf jargon playful and simple.',
  'Child and grandparent silhouetted on the green, one giant golf ball as the sun.',
  2
),
(
  'baking-with-grandma', 'grandparents',
  'The Secret Recipe',
  'Flour clouds, sweet smells, and a recipe made of love.',
  'An afternoon of baking together becomes a magical potion-making session in the family kitchen.',
  'watercolor',
  '["An invitation to the kitchen: today we bake the special recipe", "Aprons on: the kitchen becomes a workshop", "Measuring and pouring: a little spills, nobody minds", "Mixing the batter: the magic begins", "A taste test (strictly for quality control)", "Into the oven: the hardest part is waiting", "Watching through the oven window as it rises", "The sweet smell fills the whole house", "Decorating: sprinkles everywhere", "Sharing the treat: the secret ingredient was us"]',
  'Tone: cozy, sensory (smells, warmth, textures). The recipe can be the family''s real one if mentioned. Frame waiting as delicious suspense.',
  'Child and grandma peeking into a glowing oven, flour dust like stars in the air.',
  3
),
(
  'beach-treasure', 'mums',
  'The Beach Treasure Hunt',
  'Seashells, sandcastles and the best treasure of all.',
  'A beach day retold as a pirate treasure hunt — maps in the sand, shells like jewels, waves full of secrets.',
  'flat-vector',
  '["Packing the beach bag like pirates preparing to sail", "First sight of the sea: the great blue treasure map", "Toes in the sand: the hunt begins", "Collecting shells: each one a jewel with a story", "Building the fortress (sandcastle) to guard the treasure", "A wave sneaks up and everyone squeals", "Ice cream break: pirates need fuel", "The greatest treasure found: a perfect shell (or a funny crab)", "Watching the sunset paint the water", "Sandy, salty, sleepy and happy: the richest pirates ever"]',
  'Tone: playful pirate adventure, but tender. Use real beach details from the memory (location, what they found). The "treasure" resolves as the day together.',
  'Two adventurers on a shell-dotted shore, a sandcastle flying a little flag.',
  1
),
(
  'whale-watching', 'mums',
  'The Day the Whale Waved',
  'Out on the big blue, waiting for a giant to say hello.',
  'A whale-watching trip becomes a story about patience, wonder, and the moment a giant appeared.',
  'riso-print',
  '["Early morning: boots, jackets, and big expectations", "Boarding the boat: it smells like salt and adventure", "The engine hums, the shore shrinks away", "Scanning the horizon: where are you, whale?", "A splash! False alarm: just a cheeky seagull", "Waiting quietly together, hot chocolate in hand", "THERE! A spout of water like a fountain", "The whale rises: enormous, gentle, unbelievable", "It waves its tail as if saying hello, just to us", "Back on land, hearts still out at sea"]',
  'Tone: wonder and patience rewarded. Make the waiting cozy, not boring. The whale moment should feel earned and huge.',
  'A small boat and a huge friendly whale tail against a graphic sea.',
  2
),
(
  'magical-diary', 'kids',
  'The Magical Diary',
  'An ordinary notebook with a very extraordinary secret.',
  'A child''s diary comes alive: whatever gets drawn inside it happens the next day — mostly.',
  'crayon',
  '["A plain old notebook found in a drawer", "First doodle: a sunny day... and the next day, sunshine!", "Testing the magic: drawing pancakes for breakfast", "It worked! (Sort of. The pancakes were tiny.)", "Drawing a dragon: maybe too ambitious", "The dragon turns out to be the neighbor''s cat in a costume... or was it?", "Drawing the best day ever with their favorite person", "The best day ever actually happens", "Realizing the diary works because someone reads it and makes it true", "The last page: drawing all of us, together, always"]',
  'Tone: whimsical mystery with a warm reveal: the "magic" is the loving grown-up reading the diary. Keep the child as the author-hero.',
  'An open notebook glowing softly, doodles floating off the page.',
  1
),
(
  'first-day-of-school', 'kids',
  'The Big First Day',
  'New backpack, big feelings, and one brave step through the gate.',
  'The first day of school as an epic quest: nerves, new friends, and coming home a hero.',
  'watercolor',
  '["The night before: laying out clothes like armor", "Morning butterflies at breakfast", "The walk to school: hand in hand, step by step", "The gate: the biggest doorway in the world", "A brave goodbye hug", "Inside: new faces, new smells, new everything", "A wobbly moment... and a kind new friend", "Discovering something wonderful (paint! blocks! books!)", "The bell rings: running back to family arms", "Telling everything at dinner: tomorrow, again!"]',
  'Tone: honest about nerves, big on courage. The goodbye and reunion are the emotional peaks. Name the new friend if the memory mentions one.',
  'A small hero with a big backpack at the school gate, morning light ahead.',
  2
),
(
  'camping-stars', 'dads',
  'Camping Under the Stars',
  'One tent, a million stars, and stories by the fire.',
  'A camping night becomes an expedition to the edge of the wild — marshmallows included.',
  'mid-century',
  '["Loading the car: we have EVERYTHING (except, it turns out, the spoons)", "Arriving in the wild: setting up the tent (comedy ensues)", "The tent stands! Mostly.", "Exploring: tracks, sticks and treasures", "Campfire time: the most important job is marshmallows", "Stories by the fire as the sky goes dark", "Looking up: more stars than anyone can count", "Naming our own constellation", "Zipped into sleeping bags, listening to the night", "Morning in the wild: pancakes never tasted so good"]',
  'Tone: adventurous with gentle dad-humor (something small goes wrong and becomes the best part). The star moment is quiet and huge.',
  'A glowing tent under a giant starry sky, two silhouettes pointing up.',
  1
),
(
  'road-trip', 'dads',
  'The Great Family Road Trip',
  'Snacks, songs, and the open road to somewhere wonderful.',
  'The family road trip as an odyssey: every stop a chapter, every song a battle hymn.',
  'flat-vector',
  '["Packing the car like a puzzle", "Everyone in: seatbelts, snacks, GO!", "The singalong begins (nobody remembers verse two)", "I spy with my little eye: games and giggles", "The BEST rest stop ever (ice cream may be involved)", "A wrong turn becomes a secret shortcut", "Almost there: who spots it first?", "ARRIVAL! Tumbling out of the car with cheers", "The best moment of the destination", "The drive home: quiet, sleepy, full of new stories"]',
  'Tone: energetic, funny, chorus-like repetition ("are we there yet?"). Use the real destination and any real mishaps from the memory.',
  'A packed little car on a winding ribbon of road, luggage wobbling on top.',
  2
),
(
  'new-sibling', 'siblings',
  'When You Arrived',
  'The story of becoming a big brother or sister.',
  'The arrival of a new sibling, told from the big kid''s point of view — from strange news to fierce love.',
  'watercolor',
  '["Big news: someone new is coming", "Waiting and wondering: what will they be like?", "Preparing: tiny socks, a shared room, big questions", "The day arrives: everything happens fast", "Meeting for the first time: so small, so wrinkly, so... mine?", "First days: the baby mostly sleeps (and everyone whispers)", "A hard moment: sharing is not easy", "The first real smile: aimed right at the big kid", "Becoming the helper, the protector, the teacher", "Two of us now: an adventure that is just beginning"]',
  'Tone: emotionally honest (jealousy allowed, gently), ending in fierce sibling pride. The big kid is the hero and narrator perspective.',
  'Big sibling peering into a cradle, one tiny hand reaching up to them.',
  1
),
(
  'rainy-day-fort', 'siblings',
  'The Rainy Day Kingdom',
  'Couch cushions, blanket roofs, and a kingdom of two.',
  'A rainy afternoon indoors becomes the founding of a great cushion kingdom, ruled by siblings.',
  'crayon',
  '["Rain on the window: outside is cancelled", "The great idea: we shall build a KINGDOM", "Gathering supplies: every cushion in the house", "Construction: engineering disagreements are resolved", "The kingdom stands: flags up (a sock on a broom)", "Royal snacks are smuggled in", "Defending the kingdom from the terrible tickle monster (a parent)", "Quiet time inside: flashlight stories under the blanket roof", "The kingdom at sunset: golden light through blanket walls", "Leaving it up overnight: rulers need their rest"]',
  'Tone: imaginative, collaborative, sibling banter that resolves into teamwork. The parent as friendly monster is a comedy beat.',
  'A wobbly, glorious blanket fort with two crowned heads poking out.',
  2
),
(
  'first-steps', 'babies',
  'Ten Tiny Steps',
  'The wobbly, wonderful story of learning to walk.',
  'The journey from first wobble to first steps — a tiny epic of falling down and getting up.',
  'watercolor',
  '["A baby who goes everywhere: by rolling", "Discovery: furniture is for pulling up on", "Standing! The world looks different from up here", "The first brave letting-go... and a soft plop", "Trying again: this baby does not give up", "Cheering squad assembles: everyone is watching", "One step! The room holds its breath", "Two, three... walking! Wobbling! WALKING!", "Straight into the warmest arms in the world", "Now nothing is safe: a walker is born"]',
  'Tone: triumphant miniature epic. Falls are always soft and funny, never sad. The catch-hug is the emotional peak.',
  'Tiny feet mid-step, two open arms waiting, sunbeams on the floor.',
  1
)
on conflict (id) do update set
  category_id = excluded.category_id,
  title = excluded.title,
  tagline = excluded.tagline,
  description = excluded.description,
  suggested_style_id = excluded.suggested_style_id,
  story_beats = excluded.story_beats,
  prompt_scaffold = excluded.prompt_scaffold,
  cover_concept = excluded.cover_concept,
  sort_order = excluded.sort_order;
