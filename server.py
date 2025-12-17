from flask import Flask, render_template, jsonify, request
from flask_cors import CORS

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/infer", methods=["POST"])
def infer():
    # временная заглушка, чтобы проверить, что API живое
    return jsonify({"gesture": "demo"})
