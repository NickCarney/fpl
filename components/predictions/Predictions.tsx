import PredictedLineups from "./PredictedLineups";
import GamePredictions from "./GamePredictions";
import TeamPredictedPoints from "./TeamPredictedPoints";

export default function Predictions() {
  return (
    <div className="predictions-container">
      <h1>Predictions</h1>
      <div className="predictions-grid">
        <PredictedLineups />
        <GamePredictions />
        <TeamPredictedPoints />
      </div>
    </div>
  );
}
