export BASE_DIR=$PWD
export DATA_DIR=$BASE_DIR/.data
export LOG_DIR=$DATA_DIR/logs
export DB_DIR=$DATA_DIR/db
export PORT=7714
export SECRET=planet-stream-cat
echo "Open http://localhost:$PORT"
npm start