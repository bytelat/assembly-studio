from pydantic import BaseModel, Field, model_validator


class Part(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    quantity: int = Field(ge=1, le=10000)
    source_page: int = Field(ge=1)
    uncertainty: str = Field(default="", max_length=2000)


class Step(BaseModel):
    number: int = Field(ge=1)
    instruction: str = Field(min_length=1, max_length=4000)
    part_ids: list[str]
    source_page: int = Field(ge=1)
    warnings: list[str] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)


class ManualAnalysis(BaseModel):
    product_name: str = Field(min_length=1, max_length=300)
    parts: list[Part] = Field(min_length=1, max_length=500)
    steps: list[Step] = Field(min_length=1, max_length=500)
    uncertainties: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_references(self):
        ids = [part.id for part in self.parts]
        if len(set(ids)) != len(ids):
            raise ValueError("Part identifiers must be unique")
        numbers = [step.number for step in self.steps]
        if numbers != list(range(1, len(numbers) + 1)):
            raise ValueError("Steps must be ordered consecutively from 1")
        for step in self.steps:
            if set(step.part_ids) - set(ids):
                raise ValueError("Step references an unknown part")
        return self
