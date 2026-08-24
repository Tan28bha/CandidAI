from langgraph.graph import END, START, StateGraph

from app.agents.nodes import evaluator_node, interviewer_node
from app.agents.state import AgentState


def _route_start(state: AgentState) -> str:
    return "interviewer" if state.get("mode") == "question" else "evaluator"


def _route_after_eval(state: AgentState) -> str:
    if state.get("generate_next"):
        return "interviewer"
    return END


def build_interview_graph():
    graph = StateGraph(AgentState)
    graph.add_node("evaluator", evaluator_node)
    graph.add_node("interviewer", interviewer_node)
    graph.add_conditional_edges(START, _route_start, {"interviewer": "interviewer", "evaluator": "evaluator"})
    graph.add_conditional_edges("evaluator", _route_after_eval, {"interviewer": "interviewer", END: END})
    graph.add_edge("interviewer", END)
    return graph.compile()


interview_graph = build_interview_graph()
