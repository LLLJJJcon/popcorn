/**
 * Single Delivery Task 4 entry point.
 *
 * These imports register the already-accepted fixture scenarios. Keeping the
 * entry declarative prevents this release gate from copying fixture payloads,
 * SQL graphs, or queue behavior into a parallel suite.
 */
import "./extension/acquisition-save.spec";
import "./saved-learning-loop.spec";
import "./returning-learner.spec";
