const fs = require("fs");

function removeInvisibleCharacters(str) {
  return str.replace(/[\u200B-\u200D\uFEFF]/g, "");
}

class Player {
  constructor(name, gender) {
    this.name = name;
    this.gender = gender;
    this.matchesPlayed = 0;
    this.wins = 0;
    this.losses = 0;
    this.rating = 1500; // Initial Elo rating
    this.ratingHistory = [{
      rating: 1500,
      event: null  // null represents initial rating
    }];
  }

  get winRate() {
    return this.matchesPlayed === 0
      ? 0
      : (this.wins / this.matchesPlayed).toFixed(2);
  }

  get scaledRating() {
    // Scale the Elo rating to a 10-point scale
    // Assuming the minimum Elo rating is 1000 and maximum is 2000 for scaling
    const minRating = 1000;
    const maxRating = 2000;
    const scaled = ((this.rating - minRating) / (maxRating - minRating)) * 10;
    return Math.min(Math.max(scaled, 0), 10).toFixed(1); // Keep the result between 0 and 10
  }

  recordMatch(result) {
    this.matchesPlayed += 1;
    if (result === "win") {
      this.wins += 1;
    } else {
      this.losses += 1;
    }
  }

  updateRating(opponentRating, result, kFactor = 32, marginFactor = 1) {
    const expectedScore =
      1 / (1 + Math.pow(10, (opponentRating - this.rating) / 400));
    const actualScore = result === "win" ? 1 : 0;
    this.rating += kFactor * marginFactor * (actualScore - expectedScore);
  }

  getLastEventRatingChange() {
    if (this.ratingHistory.length < 2) {
      return 0; // No previous events to compare
    }
    const current = this.ratingHistory[this.ratingHistory.length - 1].rating;
    const previous = this.ratingHistory[this.ratingHistory.length - 2].rating;
    return current - previous;
  }

  // Track event-based rating changes (weekly)
  recordEventRating(eventDate) {
    // Only record if rating changed since last event
    const lastRecord = this.ratingHistory[this.ratingHistory.length - 1];
    if (lastRecord.rating !== this.rating || lastRecord.event === null) {
      this.ratingHistory.push({
        rating: this.rating,
        event: eventDate
      });
    }
  }
}

class Match {
  constructor(teamA, teamB, scoreA, scoreB) {
    this.teamA = teamA;
    this.teamB = teamB;
    this.scoreA = scoreA;
    this.scoreB = scoreB;
    this.winner = scoreA > scoreB ? teamA : teamB;
    this.loser = scoreA > scoreB ? teamB : teamA;
  }

  play() {
    const marginFactor = 1 + Math.abs(this.scoreA - this.scoreB) / 21;
    try {
      // Record match results for each player
      if (this.scoreA > this.scoreB) {
        this.teamA.forEach(player => player.recordMatch("win"));
        this.teamB.forEach(player => player.recordMatch("lose"));
        // Update ratings using doubles calculation
        this.updateRatingsForDoubles(
          this.teamA,
          this.teamB,
          "winA",
          32,
          this.scoreA,
          this.scoreB
        );
      } else {
        this.teamB.forEach(player => player.recordMatch("win"));
        this.teamA.forEach(player => player.recordMatch("lose"));
        // Update ratings using doubles calculation
        this.updateRatingsForDoubles(
          this.teamA,
          this.teamB,
          "winB",
          32,
          this.scoreA,
          this.scoreB
        );
      }
    } catch (error) {
      console.log(`Error in match ${this.teamA[0].name} - ${this.teamB[0].name}: ${error}`);
    }
  }

  updateRatingsForDoubles(teamA, teamB, result, kFactor = 32, scoreA = 0, scoreB = 0) {
    // Calculate team ratings as averages
    const ratingTeamA = (teamA[0].rating + teamA[1].rating) / 2;
    const ratingTeamB = (teamB[0].rating + teamB[1].rating) / 2;

    // Calculate expected scores
    const expectedScoreA = 1 / (1 + Math.pow(10, (ratingTeamB - ratingTeamA) / 400));
    const expectedScoreB = 1 / (1 + Math.pow(10, (ratingTeamA - ratingTeamB) / 400));

    // Actual scores
    const actualScoreA = result === "winA" ? 1 : 0;
    const actualScoreB = result === "winB" ? 1 : 0;

    // Calculate margin factor
    const marginFactor = 1 + Math.abs(scoreA - scoreB) / 21;

    // Update ratings for each player
    teamA.forEach((player) => {
      const ratingChange = kFactor * marginFactor * (actualScoreA - expectedScoreA);
      player.rating += ratingChange;
    });

    teamB.forEach((player) => {
      const ratingChange = kFactor * marginFactor * (actualScoreB - expectedScoreB);
      player.rating += ratingChange;
    });
  }
}

class Tournament {
  constructor() {
    this.players = [];
    this.matches = [];
  }

  addPlayer(playerName, initialRating = 1500, gender) {
    const normalizedName = removeInvisibleCharacters(playerName.trim());
    let player = this.getPlayerByName(normalizedName);
    
    if (!player) {
      player = new Player(normalizedName, gender);
      player.rating = initialRating;
      this.players.push(player);
      // console.log(`Added new player: ${normalizedName}`);
    } else {
      if (player.gender === undefined && gender !== undefined) {
        player.gender = gender;
        // console.log(`Updated gender for existing player: ${normalizedName}`);
      }
      // console.log(`Player already exists: ${normalizedName}`);
    }
  }

  getPlayerByName(name) {
    const normalizedName = removeInvisibleCharacters(name.toLowerCase().trim());
    const player = this.players.find(
      (player) =>
        removeInvisibleCharacters(player.name.toLowerCase().trim()) ===
        normalizedName
    );
    if (!player) {
      // console.log(`Player not found: ${name} (normalized: ${normalizedName})`); // Debug log
    }
    return player;
  }

  addMatch(teamAPlayers, teamBPlayers, scoreA, scoreB) {
    const teamA = teamAPlayers.map((playerName) =>
      this.getPlayerByName(playerName)
    );
    const teamB = teamBPlayers.map((playerName) =>
      this.getPlayerByName(playerName)
    );

    const match = new Match(teamA, teamB, scoreA, scoreB);
    match.play();
    this.matches.push(match);
  }

  generateNewPairings() {
    // Sort players based on Elo rating
    const sortedPlayers = [...this.players].sort((a, b) => b.rating - a.rating);

    // Pair the top players with the bottom players
    const pairings = [];
    const midIndex = Math.floor(sortedPlayers.length / 2);

    for (let i = 0; i < midIndex; i++) {
      const topPlayer = sortedPlayers[i];
      const bottomPlayer = sortedPlayers[sortedPlayers.length - 1 - i];
      //   pairings.push([topPlayer.name, bottomPlayer.name]);
      pairings.push([
        topPlayer.name + " (" + topPlayer.scaledRating + ")",
        bottomPlayer.name + " (" + bottomPlayer.scaledRating + ")",
      ]);
    }
    return pairings;
  }

  generateNewPairingsFromFile(filename) {
    const data = JSON.parse(fs.readFileSync(filename, "utf-8"));
    const availablePlayers = data.available_players.map(player => ({
      name: removeInvisibleCharacters(player.name.trim()),
      gender: player.gender
    }));

    // Add new players if they don't exist
    availablePlayers.forEach(player => {
      this.addPlayer(player.name, 1500, player.gender);
    });

    const availablePlayerObjects = availablePlayers
      .map(player => this.getPlayerByName(player.name))
      .filter(player => player !== undefined);

    // Sort players based on Elo rating
    const sortedMalePlayers = availablePlayerObjects.filter(p => p.gender === 'male').sort((a, b) => b.rating - a.rating);
    const sortedFemalePlayers = availablePlayerObjects.filter(p => p.gender === 'female').sort((a, b) => b.rating - a.rating);

    // Pair the players with gender balance
    const pairings = [];
    while (sortedMalePlayers.length >= 2 && sortedFemalePlayers.length >= 2) {
      // Pick top 2 male players
      const topMales = [sortedMalePlayers.shift(), sortedMalePlayers.shift()];
      
      // Pick bottom 2 female players
      const bottomFemales = [sortedFemalePlayers.pop(), sortedFemalePlayers.pop()];
      
      // Randomly pair a top male with a bottom female
      const shuffledFemales = bottomFemales.sort(() => Math.random() - 0.5);
      
      pairings.push([
        topMales[0].name + " (" + topMales[0].scaledRating + ")",
        shuffledFemales[0].name + " (" + shuffledFemales[0].scaledRating + ")"
      ]);
      pairings.push([
        topMales[1].name + " (" + topMales[1].scaledRating + ")",
        shuffledFemales[1].name + " (" + shuffledFemales[1].scaledRating + ")"
      ]);
    }

    // Handle any remaining players
    const remainingPlayers = [...sortedMalePlayers, ...sortedFemalePlayers];
    while (remainingPlayers.length >= 2) {
      const player1 = remainingPlayers.shift();
      const player2 = remainingPlayers.pop();
      pairings.push([
        player1.name + " (" + player1.scaledRating + ")",
        player2.name + " (" + player2.scaledRating + ")"
      ]);
    }

    if (remainingPlayers.length > 0) {
      const player = remainingPlayers[0];
      pairings.push([player.name + " (" + player.scaledRating + ")"]);
    }

    // Group pairings into houses, balancing the ratings and genders
    const houses = [];
    const numHouses = Math.ceil(pairings.length / 2);
    for (let i = 0; i < numHouses; i++) {
      houses.push([]);
    }

    let houseIndex = 0;
    while (pairings.length > 0) {
      houses[houseIndex].push(pairings.shift());
      houseIndex = (houseIndex + 1) % numHouses;
    }

    console.log("Next pairings (grouped into houses):");
    houses.forEach((house, index) => {
      let totalRating = 0;
      let maleCount = 0;
      let femaleCount = 0;
      let playerCount = 0;

      // Pre-calculate totals and counts
      house.forEach((pair) => {
        pair.forEach(playerStr => {
          playerCount++;
          const player = this.getPlayerByName(playerStr.split(" (")[0]);
          totalRating += player.rating;
          if (player.gender === 'male') maleCount++;
          else if (player.gender === 'female') femaleCount++;
        });
      });

      // Calculate average rating
      const averageRating = totalRating / playerCount;

      // Display house header with average rating and gender counts
      console.log(`House ${index + 1}:`);
      console.log(`Average Rating: ${averageRating.toFixed(0)}, Males: ${maleCount}, Females: ${femaleCount}`);

      // Display pairs in the house
      house.forEach((pair) => {
        console.log(`  ${pair[0]} & ${pair[1]}`);
      });

      console.log(); // Add a blank line for readability
    });

    return houses;
  }

  // Seed tournament data from JSON
  seedFromJsonFile(filename) {
    const data = JSON.parse(fs.readFileSync(filename, "utf-8"));
    const eventDate = new Date(data.event.date);

    data.teams.forEach((team) => {
      team.players.forEach((player) => {
        this.addPlayer(player.name, 1500, player.gender);
      });
    });

    // Add matches from JSON data
    data.matches.forEach((match) => {
      this.addMatch(
        match.players_a,
        match.players_b,
        match.score_a,
        match.score_b
      );
    });

    // Record ratings for this event
    this.players.forEach(player => {
      player.recordEventRating(eventDate);
    });
  }

  // Display the statistics of all players
  displayPlayerStats() {
    const sortedPlayers = [...this.players].sort((a, b) => b.rating - a.rating);

    sortedPlayers.forEach((player) => {
      console.log(
        `${player.name}: Played ${player.matchesPlayed}, Wins ${
          player.wins
        }, Losses ${player.losses}, Win Rate ${
          player.winRate
        }, Rating ${player.rating.toFixed(0)}, Scaled Rating ${
          player.scaledRating
        }`
      );
    });
  }

  // Display all matches
  displayMatches() {
    this.matches.forEach((match, index) => {
      console.log(
        `Match ${index + 1}: ${match.teamA
          .map((p) => p.name)
          .join(" & ")} vs ${match.teamB.map((p) => p.name).join(" & ")}`
      );
      console.log(
        `Score: ${match.scoreA} - ${match.scoreB}, Winner: ${match.winner
          .map((p) => p.name)
          .join(" & ")}`
      );
    });
  }

  displaySimplifiedStats(filter = null) {
    let sortedPlayers = [...this.players].sort((a, b) => b.rating - a.rating);
    
    if (filter) {
      try {
        const availableData = JSON.parse(fs.readFileSync(filter, "utf-8"));
        const availableNames = availableData.available_players.map(p => 
          removeInvisibleCharacters(p.name.trim().toLowerCase())
        );
        
        sortedPlayers = sortedPlayers.filter(player => 
          availableNames.includes(removeInvisibleCharacters(player.name.trim().toLowerCase()))
        );
      } catch (error) {
        console.log(`Error reading filter file: ${error}`);
        return;
      }
    }

    const maxNameLength = Math.max(...sortedPlayers.map(p => p.name.length));
    const totalPlayers = sortedPlayers.length;

    console.log(`\n${filter ? 'Available Players Stats:' : 'All Players Stats:'} (Total: ${totalPlayers})`);
    console.log(`${'Rank'.padEnd(4)} | ${'Name'.padEnd(maxNameLength)} | Played | Win | Lose | Scaled Rating | Weekly Δ | Total Δ `);
    console.log('-'.repeat(maxNameLength + 78));

    sortedPlayers.forEach((player, index) => {
      const totalRatingChange = player.rating - 1500;
      const totalChangeStr = totalRatingChange >= 0 ? 
        `+${totalRatingChange.toFixed(0)}` : 
        totalRatingChange.toFixed(0);
      
      const eventChange = player.getLastEventRatingChange();
      const eventChangeStr = eventChange >= 0 ? 
        `+${eventChange.toFixed(0)}` : 
        eventChange.toFixed(0);
      
      console.log(
        `${(index + 1).toString().padEnd(4)} | ` +
        `${player.name.padEnd(maxNameLength)} | ` +
        `${player.matchesPlayed.toString().padStart(6)} | ` +
        `${player.wins.toString().padStart(3)} | ` +
        `${player.losses.toString().padStart(4)} | ` +
        `${player.scaledRating.toString().padStart(13)} | ` +
        `${eventChangeStr.padStart(8)} | ` +
        `${totalChangeStr.padStart(8)} `
      );
    });
  }

}

// Usage
const tournament = new Tournament();
// tournament.addPlayer("Mirza", 1650);
tournament.seedFromJsonFile("match1.json");
tournament.seedFromJsonFile("match2.json");
tournament.seedFromJsonFile("match3.json");
// tournament.exportSimplifiedStatsAsImage("simplified_stats.png");
// tournament.addPlayer("Pop", 1650);
// tournament.addPlayer("Sue", 1200);
// tournament.addPlayer("Ammar", 1650);
// tournament.displayPlayerStats();
tournament.displaySimplifiedStats();
// tournament.displaySimplifiedStats("available_players.json");
// tournament.displayMatches();

// const newPairings = tournament.generateNewPairingsFromFile(
//   "available_players.json"
// );
// console.log("New Pairings: ", newPairings);

