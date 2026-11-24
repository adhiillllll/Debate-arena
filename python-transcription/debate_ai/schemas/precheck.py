"""Pydantic schemas for Topic Brief generation and Precheck Debater validation."""

from pydantic import BaseModel, Field


class PrecheckQuestion(BaseModel):
    question_id: str = Field(
        description="Short identifier such as 'q1', 'q2', 'q3'."
    )
    question: str = Field(
        description="A targeted readiness question for the debater to answer before the live debate."
    )
    core_concept: str = Field(
        description="The underlying debate concept or sub-issue this question tests."
    )
    expected_criteria: list[str] = Field(
        description="Key points, definitions, or types of evidence a strong answer should address."
    )
    common_fallacies: list[str] = Field(
        description="Common logical fallacies, misconceptions, or off-topic traps to watch for."
    )


class GeneratedTopicBrief(BaseModel):
    """Structured output schema returned by Gemini for topic decomposition."""

    core_summary: str = Field(
        description="Concise 2-3 sentence neutral overview of the core debate tension."
    )
    core_concepts: list[str] = Field(
        description="3 to 5 foundational concepts or dimensions central to this debate topic."
    )
    key_premises: list[str] = Field(
        description="Key factual or policy premises both sides must engage with."
    )
    questions: list[PrecheckQuestion] = Field(
        description="Exactly 3 structured precheck questions to validate debater readiness."
    )


class TopicBriefRequest(BaseModel):
    debate_id: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=200)
    topic: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, max_length=100)


class TopicBriefResponse(BaseModel):
    id: str
    debate_id: str
    core_summary: str
    core_concepts: list[str]
    key_premises: list[str]
    questions: list[PrecheckQuestion]
    model_name: str


class PrecheckValidationRequest(BaseModel):
    debate_id: str = Field(min_length=1)
    participant_id: str = Field(min_length=1)
    question_id: str = Field(min_length=1)
    debater_response: str = Field(min_length=1, max_length=4000)


class PrecheckEvaluation(BaseModel):
    """Structured output schema returned by Gemini when grading a debater's precheck response."""

    is_valid: bool = Field(
        description="True if the response is on-topic, logically coherent, and addresses the question's expected criteria."
    )
    score: float = Field(
        ge=0.0,
        le=1.0,
        description="Readiness score between 0.0 and 1.0.",
    )
    feedback: str = Field(
        description="Concise, constructive evaluation explaining what the debater did well or missed."
    )
    suggestion: str | None = Field(
        default=None,
        description="Actionable suggestion to improve the argument or add missing evidence (especially when is_valid is False).",
    )


class PrecheckValidationResponse(BaseModel):
    id: str
    debate_id: str
    participant_id: str
    question_id: str
    question_text: str
    debater_response: str
    is_valid: bool
    score: float
    feedback: str
    suggestion: str | None = None