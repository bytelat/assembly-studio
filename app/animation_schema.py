"""Product-independent motion format: offsets from source-model node transforms."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator

Distance = Annotated[FiniteFloat, Field(ge=-2, le=2)]
Angle = Annotated[FiniteFloat, Field(ge=-720, le=720)]
Vector = tuple[Distance, Distance, Distance]
EulerDegrees = tuple[Angle, Angle, Angle]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PoseKeyframe(StrictModel):
    fraction: float = Field(ge=0, le=1, allow_inf_nan=False)
    offset_m: Vector = (0, 0, 0)
    rotation_deg: EulerDegrees = (0, 0, 0)


def check_keyframes(frames):
    if len(frames) < 2:
        raise ValueError('Keyframes require at least two poses')
    if any(a.fraction >= b.fraction for a, b in zip(frames, frames[1:])):
        raise ValueError('Keyframe times must be strictly increasing')
    if all(a.offset_m == b.offset_m and a.rotation_deg == b.rotation_deg for a, b in zip(frames, frames[1:])):
        raise ValueError('Keyframes must include actual movement')


class MotionTrack(StrictModel):
    node_index: int = Field(ge=0)
    from_offset_m: Vector = (0, 0, 0)
    keyframes: list[PoseKeyframe] = Field(default_factory=list, max_length=30)
    interpolation: Literal["smooth", "linear"] = "smooth"
    to_offset_m: Vector = (0, 0, 0)
    from_rotation_deg: EulerDegrees = (0, 0, 0)
    to_rotation_deg: EulerDegrees = (0, 0, 0)
    start_fraction: float = Field(default=0, ge=0, lt=1, allow_inf_nan=False)
    end_fraction: float = Field(default=1, gt=0, le=1, allow_inf_nan=False)

    @model_validator(mode="after")
    def check_track(self):
        if self.keyframes:
            check_keyframes(self.keyframes)
            if any(abs(v) > 1e-7 for v in (*self.from_offset_m, *self.to_offset_m, *self.from_rotation_deg, *self.to_rotation_deg)):
                raise ValueError('Do not mix keyframes with legacy track transforms')
            if (self.start_fraction, self.end_fraction) not in ((0, 1), (self.keyframes[0].fraction, self.keyframes[-1].fraction)):
                raise ValueError('Redundant track timing must match keyframe times')
            return self
        if self.start_fraction >= self.end_fraction:
            raise ValueError("Track must end after it starts")
        if any(abs(v) > 1e-7 for v in (*self.to_offset_m, *self.to_rotation_deg)):
            raise ValueError("This version requires tracks to dock at the original source transform")
        if not any(abs(v) > 1e-7 for v in (*self.from_offset_m, *self.from_rotation_deg)):
            raise ValueError("A motion track must describe an actual movement")
        return self


class AnimationStep(StrictModel):
    kind: Literal["motion", "manual_reference"] = "motion"
    printed_step: int | None = Field(default=None, ge=1, le=100)
    assembly_keyframes: list[PoseKeyframe] = Field(default_factory=list, max_length=30)
    title: str = Field(min_length=1, max_length=200)
    instruction: str = Field(min_length=1, max_length=4000)
    source_pages: list[int] = Field(min_length=1, max_length=10)
    duration_seconds: float = Field(ge=1, le=30, allow_inf_nan=False)
    visible_node_ids: list[int] = Field(min_length=1, max_length=500)
    tracks: list[MotionTrack] = Field(max_length=100)
    warnings: list[str] = Field(max_length=30)
    uncertainties: list[str] = Field(max_length=30)

    @model_validator(mode="after")
    def check_nodes(self):
        if self.assembly_keyframes:
            check_keyframes(self.assembly_keyframes)
        if self.kind == "motion" and not self.tracks and not self.assembly_keyframes:
            raise ValueError("Motion steps require a motion track")
        if self.kind == "manual_reference" and (self.tracks or self.assembly_keyframes):
            raise ValueError("Manual-reference steps cannot claim animated movement")
        track_ids = [t.node_index for t in self.tracks]
        if len(set(track_ids)) != len(track_ids):
            raise ValueError("Only one track per node per step is supported")
        if len(set(self.visible_node_ids)) != len(self.visible_node_ids):
            raise ValueError("Visible node IDs must be unique")
        if set(track_ids) - set(self.visible_node_ids):
            raise ValueError("Every moving node must be visible")
        if any(page < 1 for page in self.source_pages):
            raise ValueError("Manual pages start at 1")
        return self


class AnimationPlan(StrictModel):
    schema_version: Literal[1, 2]
    assembly_pivot_m: Vector = (0, 0, 0)
    product_id: str = Field(min_length=1, max_length=100)
    source_document: str = Field(min_length=1, max_length=100)
    model_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    manual_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    coordinate_space: Literal["source_node_parent_meters"]
    steps: list[AnimationStep] = Field(min_length=1, max_length=50)


    @model_validator(mode="after")
    def check_version(self):
        if self.schema_version == 1:
            if any(self.assembly_pivot_m) or any(step.assembly_keyframes or any(track.keyframes for track in step.tracks) for step in self.steps):
                raise ValueError('Keyframes and assembly transforms require schema_version 2')
        else:
            validate_pose_continuity(self.steps)
        return self


def track_endpoints(track):
    if track.keyframes:
        return track.keyframes[0], track.keyframes[-1]
    return (PoseKeyframe(fraction=0, offset_m=track.from_offset_m, rotation_deg=track.from_rotation_deg),
            PoseKeyframe(fraction=1, offset_m=track.to_offset_m, rotation_deg=track.to_rotation_deg))


def same_pose(a, b):
    return all(abs(x-y) <= 1e-6 for x, y in zip((*a.offset_m, *a.rotation_deg), (*b.offset_m, *b.rotation_deg)))


def validate_pose_continuity(steps):
    previous_visible = set()
    poses = {}
    assembly = None
    zero = PoseKeyframe(fraction=0)
    for step in steps:
        visible = set(step.visible_node_ids)
        if previous_visible - visible:
            raise ValueError('Continuation hides previously assembled nodes')
        for track in step.tracks:
            start, end = track_endpoints(track)
            if track.node_index in previous_visible and not same_pose(start, poses.get(track.node_index, zero)):
                raise ValueError(f'Node {track.node_index} jumps between steps')
            poses[track.node_index] = end
        if step.assembly_keyframes:
            if assembly is not None and not same_pose(assembly, step.assembly_keyframes[0]):
                raise ValueError('Assembly transform jumps between steps')
            if previous_visible and assembly is None and not same_pose(zero, step.assembly_keyframes[0]):
                raise ValueError('Assembly transform jumps from the prior identity pose')
            assembly = step.assembly_keyframes[-1]
        previous_visible = visible


class GenerationDecision(StrictModel):
    can_propose: bool
    reason: str = Field(min_length=1, max_length=4000)
    plan: AnimationPlan | None

    @model_validator(mode="after")
    def check_decision(self):
        if self.can_propose != (self.plan is not None):
            raise ValueError("A proposed animation needs a plan; an abstention must not include one")
        return self


class KeyframeTrack(StrictModel):
    """Generation-only v2 contract: one authoritative timeline, no legacy timing."""
    node_index: int = Field(ge=0)
    keyframes: list[PoseKeyframe] = Field(min_length=2, max_length=30)
    interpolation: Literal['smooth', 'linear'] = 'smooth'

    @model_validator(mode='after')
    def check_frames(self):
        check_keyframes(self.keyframes)
        return self


class KeyframeStep(AnimationStep):
    tracks: list[KeyframeTrack] = Field(max_length=100)


class KeyframePlan(AnimationPlan):
    schema_version: Literal[2]
    steps: list[KeyframeStep] = Field(min_length=1, max_length=50)


class KeyframeDecision(GenerationDecision):
    plan: KeyframePlan | None
