Sam — Monte Carlo & Integration
Files: deck.js, handEvaluator.js, monteCarlo.js, script.js
Your tasks:
- Keep the tested poker engine working.
- Move the existing JavaScript interactions from index.html into script.js.
- Connect the website's card inputs to monteCarlo().
- Convert the original card objects (e.g. {r:"A",s:"s"}) into strings ("As").
- Connect the simulation button to the new engine.
- Integrate your teammates' components.
  Deliverable: A working website that calculates and displays win probabilities.




Devanshi — Frontend & UI/UX
Files: index.html, style.css
Their tasks:
- Move the original CSS from the HTML <style> block into style.css.
- Preserve the existing Tailwind styling.
- Improve the poker table and card selection interface.
- Create polished probability and betting recommendation displays.
- Add loading animations and responsive mobile layouts.
- Coordinate with you on HTML element IDs and button behavior.
  Deliverable: A polished, responsive poker website ready for your JavaScript integration.




Chris — Gemini AI Integration
Files: gemini.js, server.js, .env.example
Their tasks:
- Extract the original Gemini chatbot logic into gemini.js.
- Set up a backend in server.js that calls the Gemini API.
- Create prompts incorporating player cards, community cards, win probability, pot size, and amount to call.
- Support follow-up questions and chat history.
- Handle invalid API keys, request failures, and loading states.
- Keep the real API key out of frontend code and GitHub.
  Deliverable: A functioning AI coach that explains poker situations using Monte Carlo results.




Daniel — Poker Strategy, Testing & Deployment
Files: strategy.js, test files, README.md
Their tasks:
- Extract the original pot odds and expected value calculations into strategy.js.
- Implement the betting recommendation logic (check, call, raise, fold).
- Clearly distinguish mathematical calculations from heuristic advice.
- Test the poker engine under different game scenarios.
- Write the README and prepare the hackathon demo.
- Help deploy the completed website.
  Deliverable: Working strategy calculations, documented tests, and a demo-ready project.