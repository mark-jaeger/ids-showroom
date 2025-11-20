# Working with Claude - IDS PIM Ingress

## Implementation Workflow

### Starting a Session
1. Read `current-session.md` for latest state
2. Read relevant issue doc from `docs/issues/`
3. Review related ADRs in `docs/decisions/`
4. Check `docs/lessons-learned.md` for gotchas

### Making Changes

**⚠️ CRITICAL: USER INVOLVEMENT IN ARCHITECTURE**

**NEVER make architectural decisions in isolation.** The user must be involved in ALL significant design choices. Before doing any work, explain what you want to do in plain english and ask user for approval. 

**What requires user involvement:**

- Module structure and boundaries
- Data flow architecture
- Technology/library choices
- Data structure designs (JSON schemas, database models)
- Major algorithm choices (fuzzy matching, chunking strategies)
- Performance/cost trade-off decisions
- API integration approaches
- Error handling strategies

**Before implementing any architecture:**

1. **Present options** - Show 2-3 approaches with pros/cons
2. **Create visual diagrams** - ASCII art, draw.io, or simple sketches
3. **Show data contracts** - Actual JSON examples of inputs/outputs
4. **Explain trade-offs** - Cost, complexity, scalability, maintainability
5. **Wait for user approval** - Don't proceed without explicit confirmation

**During implementation:**

1. Create detailed implementation plan (share with user first)
2. Work incrementally (one component at a time)
3. Test after each change
4. Update documentation as you go
5. **Document issues encountered** - Create issue file in `docs/issues/` for each problem solved
6. Commit after each working change
7. Update `current-session.md` at milestones
8. **Check in with user** when discovering complexity or making design adjustments

### Branch and PR Workflow

**For each new issue or feature:**

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/descriptive-name
   # or
   git checkout -b fix/issue-number-description
   ```

2. **Make changes and commit**:
   - Follow the "Making Changes" workflow above
   - Commit incrementally to the feature branch
   - Push branch to GitHub: `git push origin feature/descriptive-name`

3. **Create a Pull Request**:
   ```bash
   gh pr create --title "Feature: descriptive title" --body "Description of changes"
   ```

4. **Have Claude Code review the PR**:
   - Use Claude Code to review the PR before merging
   - Claude will analyze changes, check for issues, and provide feedback
   - Address any concerns raised in the review

5. **Merge after approval**:
   - Merge PR to main once review is complete
   - Delete feature branch after merge

**Benefits:**
- Creates reviewable units of work
- Maintains clean main branch history
- Enables code review by Claude Code
- Provides rollback points if needed
- Documents decision-making in PR comments

### Completing Work
1. Run end-to-end verification
2. Update issue doc with resolution summary (ensure status is marked as ✅ RESOLVED)
3. **ALWAYS move resolved issues to `docs/issues/resolved/`** - This is MANDATORY:
   - Active/in-progress issues stay in `docs/issues/`
   - Completed issues MUST be moved to `docs/issues/resolved/`
   - Use `mv docs/issues/ISSUE-XXX-*.md docs/issues/resolved/`
   - This keeps the active issues directory clean and focused
4. Extract learnings to `docs/lessons-learned.md`
5. Update `current-session.md` with final state

## Key Principles

1. **User involvement first** - **NEVER design architecture alone**. Always present options and get approval.
2. **Visual documentation required** - Diagrams, not just text. Show data flow.
3. **Data contracts upfront** - Document JSON shapes before coding.
4. **Test incrementally** - Don't build much before testing.
5. **Keep it simple** - Avoid complexity. Start minimal, add only when needed.
6. **Preserve raw data** - Store original responses for reprocessing.
7. **Discover, don't prescribe** - Find ALL attributes, not just known ones.
8. **Confidence scoring** - Mark uncertain data for human review.

## Issue Documentation Requirements

**CRITICAL**: For every problem encountered and solved during development, create a comprehensive issue document in `docs/issues/`.

### When to Create an Issue Document

Create an issue file for:
- **Bugs fixed** during implementation
- **API mismatches** discovered and worked around
- **Unexpected behavior** that required code changes
- **Data quality issues** and their solutions
- **Architecture decisions** made in response to problems
- **Performance issues** and optimizations
- **Integration problems** with external services

### Issue Document Template

Each issue document must include:

1. **Header**:
   - Status (In Progress / ✅ RESOLVED)
   - Date
   - Severity (Low/Medium/High/Blocker)
   - Component (which part of codebase)

2. **Problem Section**:
   - Clear description of the issue
   - Observed behavior with examples
   - User reports or error messages
   - Investigation steps taken

3. **Root Cause**:
   - Technical explanation of why it occurred
   - Code references with line numbers
   - API behavior or misunderstanding

4. **Solution**:
   - Implementation details with code snippets
   - File paths and line numbers
   - Before/after comparisons
   - Results and verification

5. **Additional Sections**:
   - Benefits of the solution
   - Trade-offs considered
   - Lessons learned
   - Related issues
   - Testing instructions
   - References to code

### File Naming Convention

Use sequential numbering: `ISSUE-001-descriptive-name.md`, `ISSUE-002-descriptive-name.md`, etc.

### Issue Lifecycle

1. **Create** issue document in `docs/issues/` when problem is encountered
2. **Update** status to "✅ RESOLVED" when solution is implemented and tested
3. **Move** to `docs/issues/resolved/` once issue is completely resolved
4. Active/in-progress issues stay in `docs/issues/`
5. Completed issues go to `docs/issues/resolved/` for historical reference

### Why This Matters

Issue documentation:
- Provides historical context for future changes
- Helps onboard new developers
- Tracks evolution of the codebase
- Documents API quirks and workarounds
- Creates searchable knowledge base
- Prevents repeating mistakes

**Remember**: If you solve a problem, document it immediately in `docs/issues/` before moving on.

## Gotchas & Known Issues

(None yet - will be populated as work progresses)

See `docs/lessons-learned.md` for historical context from similar projects.

## Communication Preferences

- **Always involve user in design decisions** - Present options, not finished solutions
- **Create visual documentation** - Diagrams and examples, not just text explanations
- Direct, factual, no fluff
- Highlight critical issues immediately
- Explain technical reasoning and trade-offs
- **Ask clarifying questions BEFORE implementing** - Don't assume requirements
- Never use emojis unless explicitly requested
- **Check in frequently** during complex implementations

### Visual Context in Output

Also include visual separators in console output for context when user returns:

```
============================================================
⚠️  ACTION REQUIRED - USER ATTENTION NEEDED
============================================================
Message: Extraction complete. Review output/ directory.
Next Steps:
1. Check output/summary-*.txt
2. Review verification queue
3. Decide whether to proceed with full extraction
============================================================
```
