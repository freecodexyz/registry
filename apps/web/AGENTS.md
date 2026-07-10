## Coding Guidelines For Agents
* When working inside a package or subproject, read its nearest sub-AGENTS.md first.

* Keep components pure: render from props, state, and context without side effects or mutations.

* Organize code by feature, with dependencies flowing from app to features to shared modules.

* Design component props around domain intent, not internal setters, API clients, routers, or state-library details.

* Use discriminated unions to model mutually exclusive states and make invalid prop combinations impossible.

* Prefer composition over large configurable components with many boolean or optional props.

* Keep state minimal and place it in the narrowest component that legitimately owns it.

* Put shareable navigation state such as filters, sorting, pagination, and selected IDs in the URL.

* Keep server data in route loaders, framework data APIs, or query caches rather than copying it into local or global state.

* Never store values that can be derived from existing props or state during rendering.

* Use functional state updates when the next value depends on the previous value.

* Use reducers for workflows with related transitions and invariants, not for simple independent values.

* Use effects only to synchronize with external systems such as subscriptions, timers, browser APIs, or imperative libraries.

* Keep user-triggered operations inside event handlers instead of routing them through state and effects.

* Never suppress effect dependency warnings; restructure the code to eliminate stale closures and incorrect synchronization.

* Clean up every effect that creates a subscription, listener, timer, connection, or external resource.

* Use refs only for mutable values that do not affect rendering, such as DOM nodes or library instances.

* Load data at route or feature boundaries and pass typed data and callbacks into presentational components.

* Explicitly handle loading, error, empty, and success states for every asynchronous view.

* Use error boundaries around routes and major features to isolate unexpected rendering failures.

* Use Suspense and lazy loading at meaningful route or feature boundaries, not around every small component.

* Build custom hooks around reusable capabilities and expose intent-oriented operations instead of raw internal setters.

* Use context only for genuinely shared scoped dependencies, and wrap each context with a domain-specific hook.

* Prefer native semantic HTML and accessible controls before adding ARIA or custom interaction behavior.

* Build forms with native form semantics, associate labels and errors correctly, and keep server-side validation authoritative.

* Enable strict TypeScript and use types to encode domain invariants, nullability, async states, and workflow transitions.

* Treat external data as unknown until it has been validated at runtime.

* Use stable domain identifiers as list keys and never use array indexes when items can be reordered or removed.

* Optimize architecture before memoization: localize state, reduce render scope, split routes, and avoid oversized contexts.

* Add memo, useMemo, or useCallback only after profiling shows a measurable need.

* Test observable behavior through roles, labels, user actions, and visible output rather than implementation details.

* Unit-test pure domain logic, integration-test features, and protect critical workflows with a small end-to-end test suite.

* Require linting, type-checking, tests, and a production build to pass in CI before code can be merged.
