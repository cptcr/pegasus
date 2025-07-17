export interface TriviaQuestion {
  question: string;
  answers: string[];
  correct: number;
  category: string;
  difficulty: string;
}

export const trivia: TriviaQuestion[] = [
  // Geography - Easy
  {
    question: "What is the capital of France?",
    answers: ["London", "Berlin", "Paris", "Madrid"],
    correct: 2,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "Which continent is Egypt in?",
    answers: ["Asia", "Africa", "Europe", "South America"],
    correct: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is the largest country in the world?",
    answers: ["Canada", "Russia", "China", "United States"],
    correct: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "Which ocean is the largest?",
    answers: ["Atlantic", "Indian", "Arctic", "Pacific"],
    correct: 3,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is the capital of Japan?",
    answers: ["Osaka", "Tokyo", "Kyoto", "Hiroshima"],
    correct: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "Which mountain range contains Mount Everest?",
    answers: ["Andes", "Rocky Mountains", "Himalayas", "Alps"],
    correct: 2,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is the longest river in the world?",
    answers: ["Amazon", "Nile", "Mississippi", "Yangtze"],
    correct: 1,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "Which desert is the largest in the world?",
    answers: ["Sahara", "Gobi", "Kalahari", "Arabian"],
    correct: 0,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "What is the capital of Australia?",
    answers: ["Sydney", "Melbourne", "Canberra", "Perth"],
    correct: 2,
    category: "Geography",
    difficulty: "easy"
  },
  {
    question: "Which country has the most time zones?",
    answers: ["Russia", "United States", "China", "France"],
    correct: 3,
    category: "Geography",
    difficulty: "easy"
  },

  // Geography - Medium
  {
    question: "What is the smallest country in the world?",
    answers: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"],
    correct: 1,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which strait separates Europe and Africa?",
    answers: ["Bering Strait", "Strait of Gibraltar", "Strait of Hormuz", "Bass Strait"],
    correct: 1,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "What is the deepest point on Earth?",
    answers: ["Mariana Trench", "Puerto Rico Trench", "Java Trench", "Peru-Chile Trench"],
    correct: 0,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which African country was never colonized?",
    answers: ["Ethiopia", "Liberia", "Both Ethiopia and Liberia", "Morocco"],
    correct: 2,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "What is the highest waterfall in the world?",
    answers: ["Niagara Falls", "Victoria Falls", "Angel Falls", "Iguazu Falls"],
    correct: 2,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which European country has the most islands?",
    answers: ["Norway", "Finland", "Sweden", "Denmark"],
    correct: 2,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "What is the driest place on Earth?",
    answers: ["Death Valley", "Sahara Desert", "Atacama Desert", "Antarctic Dry Valleys"],
    correct: 3,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which sea is the saltiest?",
    answers: ["Dead Sea", "Red Sea", "Mediterranean Sea", "Black Sea"],
    correct: 0,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "What is the most populous city in the world?",
    answers: ["Shanghai", "Tokyo", "Mumbai", "São Paulo"],
    correct: 1,
    category: "Geography",
    difficulty: "medium"
  },
  {
    question: "Which country has the longest coastline?",
    answers: ["Russia", "Canada", "Australia", "Norway"],
    correct: 1,
    category: "Geography",
    difficulty: "medium"
  },

  // Science - Easy
  {
    question: "Which planet is known as the Red Planet?",
    answers: ["Venus", "Mars", "Jupiter", "Saturn"],
    correct: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What gas makes up most of Earth's atmosphere?",
    answers: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
    correct: 2,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "How many bones are in an adult human body?",
    answers: ["206", "215", "198", "224"],
    correct: 0,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the chemical symbol for water?",
    answers: ["H2O", "CO2", "NaCl", "CH4"],
    correct: 0,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "Which organ produces insulin?",
    answers: ["Liver", "Kidney", "Pancreas", "Heart"],
    correct: 2,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the hardest natural substance?",
    answers: ["Gold", "Iron", "Diamond", "Platinum"],
    correct: 2,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "How many chambers does a human heart have?",
    answers: ["2", "3", "4", "5"],
    correct: 2,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the fastest land animal?",
    answers: ["Lion", "Cheetah", "Leopard", "Horse"],
    correct: 1,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "Which blood type is known as the universal donor?",
    answers: ["A", "B", "AB", "O"],
    correct: 3,
    category: "Science",
    difficulty: "easy"
  },
  {
    question: "What is the study of earthquakes called?",
    answers: ["Geology", "Seismology", "Meteorology", "Astronomy"],
    correct: 1,
    category: "Science",
    difficulty: "easy"
  },

  // Science - Medium
  {
    question: "What is the chemical symbol for gold?",
    answers: ["Go", "Gd", "Au", "Ag"],
    correct: 2,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "Which scientist developed the theory of relativity?",
    answers: ["Newton", "Einstein", "Galileo", "Darwin"],
    correct: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the pH of pure water?",
    answers: ["6", "7", "8", "9"],
    correct: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "Which element has the highest melting point?",
    answers: ["Iron", "Tungsten", "Carbon", "Platinum"],
    correct: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the powerhouse of the cell?",
    answers: ["Nucleus", "Ribosome", "Mitochondria", "Endoplasmic Reticulum"],
    correct: 2,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "Which gas is most abundant in the Sun?",
    answers: ["Helium", "Hydrogen", "Oxygen", "Nitrogen"],
    correct: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the unit of electrical resistance?",
    answers: ["Volt", "Ampere", "Ohm", "Watt"],
    correct: 2,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "Which organ is affected by hepatitis?",
    answers: ["Heart", "Lungs", "Liver", "Kidneys"],
    correct: 2,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "What is the speed of sound in air at room temperature?",
    answers: ["300 m/s", "343 m/s", "400 m/s", "500 m/s"],
    correct: 1,
    category: "Science",
    difficulty: "medium"
  },
  {
    question: "Which particle has no electric charge?",
    answers: ["Proton", "Electron", "Neutron", "Ion"],
    correct: 2,
    category: "Science",
    difficulty: "medium"
  },

  // History - Easy
  {
    question: "In which year did World War II end?",
    answers: ["1944", "1945", "1946", "1947"],
    correct: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "Who was the first President of the United States?",
    answers: ["Thomas Jefferson", "John Adams", "George Washington", "Benjamin Franklin"],
    correct: 2,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "Which ancient wonder of the world was located in Alexandria?",
    answers: ["Colossus of Rhodes", "Lighthouse of Alexandria", "Hanging Gardens", "Statue of Zeus"],
    correct: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "In which year did the Berlin Wall fall?",
    answers: ["1987", "1988", "1989", "1990"],
    correct: 2,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "Who was known as the Iron Lady?",
    answers: ["Angela Merkel", "Margaret Thatcher", "Golda Meir", "Indira Gandhi"],
    correct: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "Which empire was ruled by Julius Caesar?",
    answers: ["Greek Empire", "Roman Empire", "Persian Empire", "Egyptian Empire"],
    correct: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "In which year did the Titanic sink?",
    answers: ["1910", "1911", "1912", "1913"],
    correct: 2,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "Who invented the telephone?",
    answers: ["Thomas Edison", "Alexander Graham Bell", "Nikola Tesla", "Benjamin Franklin"],
    correct: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "Which war was fought between the North and South in America?",
    answers: ["Revolutionary War", "Civil War", "War of 1812", "Mexican-American War"],
    correct: 1,
    category: "History",
    difficulty: "easy"
  },
  {
    question: "Who wrote the Declaration of Independence?",
    answers: ["George Washington", "Benjamin Franklin", "Thomas Jefferson", "John Adams"],
    correct: 2,
    category: "History",
    difficulty: "easy"
  },

  // History - Medium
  {
    question: "Which battle marked the turning point of World War II in the Pacific?",
    answers: ["Pearl Harbor", "Battle of Midway", "Battle of Iwo Jima", "Battle of Guadalcanal"],
    correct: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who was the last Pharaoh of Egypt?",
    answers: ["Cleopatra VII", "Nefertiti", "Hatshepsut", "Ankhesenamun"],
    correct: 0,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Which treaty ended World War I?",
    answers: ["Treaty of Versailles", "Treaty of Paris", "Treaty of Vienna", "Treaty of Ghent"],
    correct: 0,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who was the first person to circumnavigate the globe?",
    answers: ["Christopher Columbus", "Vasco da Gama", "Ferdinand Magellan", "James Cook"],
    correct: 2,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Which revolution began in 1789?",
    answers: ["American Revolution", "French Revolution", "Russian Revolution", "Industrial Revolution"],
    correct: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who was the first woman to win a Nobel Prize?",
    answers: ["Marie Curie", "Dorothy Hodgkin", "Rosalind Franklin", "Lise Meitner"],
    correct: 0,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Which ancient civilization built Machu Picchu?",
    answers: ["Maya", "Aztec", "Inca", "Olmec"],
    correct: 2,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "In which year did the Soviet Union dissolve?",
    answers: ["1989", "1990", "1991", "1992"],
    correct: 2,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Who was the leader of Nazi Germany?",
    answers: ["Heinrich Himmler", "Adolf Hitler", "Joseph Goebbels", "Hermann Göring"],
    correct: 1,
    category: "History",
    difficulty: "medium"
  },
  {
    question: "Which war lasted from 1955 to 1975?",
    answers: ["Korean War", "Vietnam War", "Cold War", "Gulf War"],
    correct: 1,
    category: "History",
    difficulty: "medium"
  },

  // Literature - Easy
  {
    question: "Who wrote 'Romeo and Juliet'?",
    answers: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
    correct: 1,
    category: "Literature",
    difficulty: "easy"
  },
  {
    question: "Which book series features Harry Potter?",
    answers: ["Twilight", "The Hunger Games", "Harry Potter", "Percy Jackson"],
    correct: 2,
    category: "Literature",
    difficulty: "easy"
  },
  {
    question: "Who wrote 'Pride and Prejudice'?",
    answers: ["Charlotte Brontë", "Emily Brontë", "Jane Austen", "George Eliot"],
    correct: 2,
    category: "Literature",
    difficulty: "easy"
  },
  {
    question: "Which novel begins with 'Call me Ishmael'?",
    answers: ["Moby Dick", "The Great Gatsby", "To Kill a Mockingbird", "1984"],
    correct: 0,
    category: "Literature",
    difficulty: "easy"
  },
  {
    question: "Who created the character Sherlock Holmes?",
    answers: ["Edgar Allan Poe", "Arthur Conan Doyle", "Agatha Christie", "Raymond Chandler"],
    correct: 1,
    category: "Literature",
    difficulty: "easy"
  },
  {
    question: "Which book is about a young girl named Scout Finch?",
    answers: ["To Kill a Mockingbird", "Little Women", "Anne of Green Gables", "The Secret Garden"],
    correct: 0,
    category: "Literature",
    difficulty: "easy"
  },
  {
    question: "Who wrote 'The Lord of the Rings'?",
    answers: ["C.S. Lewis", "J.R.R. Tolkien", "George R.R. Martin", "Terry Pratchett"],
    correct: 1,
    category: "Literature",
    difficulty: "easy"
  },
  {
    question: "Which Shakespeare play features the quote 'To be or not to be'?",
    answers: ["Macbeth", "Romeo and Juliet", "Hamlet", "Othello"],
    correct: 2,
    category: "Literature",
    difficulty: "easy"
  },
  {
    question: "Who wrote 'The Chronicles of Narnia'?",
    answers: ["J.R.R. Tolkien", "C.S. Lewis", "Philip Pullman", "Roald Dahl"],
    correct: 1,
    category: "Literature",
    difficulty: "easy"
  },
  {
    question: "Which novel features the character Atticus Finch?",
    answers: ["To Kill a Mockingbird", "The Catcher in the Rye", "Of Mice and Men", "The Great Gatsby"],
    correct: 0,
    category: "Literature",
    difficulty: "easy"
  },

  // Literature - Medium
  {
    question: "Who wrote the novel '1984'?",
    answers: ["Aldous Huxley", "George Orwell", "Ray Bradbury", "J.K. Rowling"],
    correct: 1,
    category: "Literature",
    difficulty: "medium"
  },
  {
    question: "Which Russian author wrote 'War and Peace'?",
    answers: ["Fyodor Dostoevsky", "Leo Tolstoy", "Anton Chekhov", "Ivan Turgenev"],
    correct: 1,
    category: "Literature",
    difficulty: "medium"
  },
  {
    question: "Who wrote 'One Hundred Years of Solitude'?",
    answers: ["Jorge Luis Borges", "Gabriel García Márquez", "Mario Vargas Llosa", "Pablo Neruda"],
    correct: 1,
    category: "Literature",
    difficulty: "medium"
  },
  {
    question: "Which novel won the 2020 Pulitzer Prize for Fiction?",
    answers: ["The Nickel Boys", "The Overstory", "American Dirt", "The Testaments"],
    correct: 0,
    category: "Literature",
    difficulty: "medium"
  },
  {
    question: "Who wrote 'The Sound and the Fury'?",
    answers: ["Ernest Hemingway", "William Faulkner", "F. Scott Fitzgerald", "John Steinbeck"],
    correct: 1,
    category: "Literature",
    difficulty: "medium"
  },
  {
    question: "Which poet wrote 'The Waste Land'?",
    answers: ["W.H. Auden", "T.S. Eliot", "Ezra Pound", "Robert Frost"],
    correct: 1,
    category: "Literature",
    difficulty: "medium"
  },
  {
    question: "Who wrote 'Beloved'?",
    answers: ["Maya Angelou", "Toni Morrison", "Alice Walker", "Zora Neale Hurston"],
    correct: 1,
    category: "Literature",
    difficulty: "medium"
  },
  {
    question: "Which dystopian novel features the character Winston Smith?",
    answers: ["Brave New World", "Fahrenheit 451", "1984", "The Handmaid's Tale"],
    correct: 2,
    category: "Literature",
    difficulty: "medium"
  },
  {
    question: "Who wrote 'The Great Gatsby'?",
    answers: ["Ernest Hemingway", "F. Scott Fitzgerald", "William Faulkner", "John Steinbeck"],
    correct: 1,
    category: "Literature",
    difficulty: "medium"
  },
  {
    question: "Which author created the character Jay Gatsby?",
    answers: ["Ernest Hemingway", "F. Scott Fitzgerald", "William Faulkner", "John Steinbeck"],
    correct: 1,
    category: "Literature",
    difficulty: "medium"
  },

  // Sports - Easy
  {
    question: "How many players are on a basketball team on the court at one time?",
    answers: ["4", "5", "6", "7"],
    correct: 1,
    category: "Sports",
    difficulty: "easy"
  },
  {
    question: "Which sport is known as 'the beautiful game'?",
    answers: ["Basketball", "Tennis", "Soccer", "Baseball"],
    correct: 2,
    category: "Sports",
    difficulty: "easy"
  },
  {
    question: "How many holes are played in a regulation round of golf?",
    answers: ["16", "18", "20", "22"],
    correct: 1,
    category: "Sports",
    difficulty: "easy"
  },
  {
    question: "Which country hosts the Wimbledon tennis tournament?",
    answers: ["France", "United States", "England", "Australia"],
    correct: 2,
    category: "Sports",
    difficulty: "easy"
  },
  {
    question: "How often are the Summer Olympic Games held?",
    answers: ["Every 2 years", "Every 4 years", "Every 6 years", "Every 8 years"],
    correct: 1,
    category: "Sports",
    difficulty: "easy"
  },
  {
    question: "In which sport would you perform a slam dunk?",
    answers: ["Volleyball", "Tennis", "Basketball", "Badminton"],
    correct: 2,
    category: "Sports",
    difficulty: "easy"
  },
  {
    question: "What is the maximum score possible in ten-pin bowling?",
    answers: ["250", "300", "350", "400"],
    correct: 1,
    category: "Sports",
    difficulty: "easy"
  },
  {
    question: "Which sport uses a puck?",
    answers: ["Soccer", "Hockey", "Tennis", "Baseball"],
    correct: 1,
    category: "Sports",
    difficulty: "easy"
  },
  {
    question: "How many bases are there in baseball?",
    answers: ["3", "4", "5", "6"],
    correct: 1,
    category: "Sports",
    difficulty: "easy"
  },
  {
    question: "Which sport is Tiger Woods famous for?",
    answers: ["Tennis", "Golf", "Basketball", "Baseball"],
    correct: 1,
    category: "Sports",
    difficulty: "easy"
  },

  // Sports - Medium
  {
    question: "Which country has won the most FIFA World Cups?",
    answers: ["Germany", "Argentina", "Italy", "Brazil"],
    correct: 3,
    category: "Sports",
    difficulty: "medium"
  },
  {
    question: "Who holds the record for most home runs in a single MLB season?",
    answers: ["Babe Ruth", "Barry Bonds", "Mark McGwire", "Sammy Sosa"],
    correct: 1,
    category: "Sports",
    difficulty: "medium"
  },
  {
    question: "Which tennis player has won the most Grand Slam singles titles?",
    answers: ["Roger Federer", "Rafael Nadal", "Novak Djokovic", "Serena Williams"],
    correct: 2,
    category: "Sports",
    difficulty: "medium"
  },
  {
    question: "In which year were the first modern Olympic Games held?",
    answers: ["1892", "1894", "1896", "1898"],
    correct: 2,
    category: "Sports",
    difficulty: "medium"
  },
  {
    question: "Which NBA team has won the most championships?",
    answers: ["Los Angeles Lakers", "Boston Celtics", "Chicago Bulls", "Golden State Warriors"],
    correct: 1,
    category: "Sports",
    difficulty: "medium"
  },
  {
    question: "What is the term for three strikes in a row in bowling?",
    answers: ["Turkey", "Eagle", "Birdie", "Spare"],
    correct: 0,
    category: "Sports",
    difficulty: "medium"
  },
  {
    question: "Which golfer has won the most major championships?",
    answers: ["Tiger Woods", "Jack Nicklaus", "Arnold Palmer", "Gary Player"],
    correct: 1,
    category: "Sports",
    difficulty: "medium"
  },
  {
    question: "In American football, how many points is a touchdown worth?",
    answers: ["5", "6", "7", "8"],
    correct: 1,
    category: "Sports",
    difficulty: "medium"
  },
  {
    question: "Which swimmer has won the most Olympic gold medals?",
    answers: ["Mark Spitz", "Michael Phelps", "Ian Thorpe", "Caeleb Dressel"],
    correct: 1,
    category: "Sports",
    difficulty: "medium"
  },
  {
    question: "What is the distance of a marathon?",
    answers: ["25.2 miles", "26.2 miles", "27.2 miles", "28.2 miles"],
    correct: 1,
    category: "Sports",
    difficulty: "medium"
  },

  // Art - Easy
  {
    question: "Who painted the Mona Lisa?",
    answers: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Michelangelo"],
    correct: 2,
    category: "Art",
    difficulty: "easy"
  },
  {
    question: "Which artist cut off his own ear?",
    answers: ["Pablo Picasso", "Vincent van Gogh", "Claude Monet", "Edgar Degas"],
    correct: 1,
    category: "Art",
    difficulty: "easy"
  },
  {
    question: "In which museum is the Mona Lisa displayed?",
    answers: ["Metropolitan Museum", "British Museum", "Louvre", "Uffizi Gallery"],
    correct: 2,
    category: "Art",
    difficulty: "easy"
  },
  {
    question: "Who painted 'Starry Night'?",
    answers: ["Claude Monet", "Vincent van Gogh", "Pablo Picasso", "Salvador Dalí"],
    correct: 1,
    category: "Art",
    difficulty: "easy"
  },
  {
    question: "Which artist is famous for painting water lilies?",
    answers: ["Claude Monet", "Pierre-Auguste Renoir", "Edgar Degas", "Paul Cézanne"],
    correct: 0,
    category: "Art",
    difficulty: "easy"
  },
  {
    question: "What type of art is Auguste Rodin famous for?",
    answers: ["Painting", "Sculpture", "Photography", "Drawing"],
    correct: 1,
    category: "Art",
    difficulty: "easy"
  },
  {
    question: "Which movement was Pablo Picasso associated with?",
    answers: ["Impressionism", "Cubism", "Surrealism", "Abstract Expressionism"],
    correct: 1,
    category: "Art",
    difficulty: "easy"
  },
  {
    question: "Who painted the ceiling of the Sistine Chapel?",
    answers: ["Leonardo da Vinci", "Raphael", "Michelangelo", "Donatello"],
    correct: 2,
    category: "Art",
    difficulty: "easy"
  },
  {
    question: "Which color is NOT a primary color?",
    answers: ["Red", "Blue", "Green", "Yellow"],
    correct: 2,
    category: "Art",
    difficulty: "easy"
  },
  {
    question: "What is the art of paper folding called?",
    answers: ["Kirigami", "Origami", "Ikebana", "Shodō"],
    correct: 1,
    category: "Art",
    difficulty: "easy"
  },

  // Art - Medium
  {
    question: "Which artist painted 'The Persistence of Memory'?",
    answers: ["Pablo Picasso", "Salvador Dalí", "René Magritte", "Max Ernst"],
    correct: 1,
    category: "Art",
    difficulty: "medium"
  },
  {
    question: "What art movement was characterized by small, thin brush strokes?",
    answers: ["Cubism", "Surrealism", "Impressionism", "Abstract Expressionism"],
    correct: 2,
    category: "Art",
    difficulty: "medium"
  },
  {
    question: "Who painted 'American Gothic'?",
    answers: ["Edward Hopper", "Grant Wood", "Georgia O'Keeffe", "Andrew Wyeth"],
    correct: 1,
    category: "Art",
    difficulty: "medium"
  },
  {
    question: "Which artist is known for his Blue Period?",
    answers: ["Vincent van Gogh", "Pablo Picasso", "Henri Matisse", "Paul Gauguin"],
    correct: 1,
    category: "Art",
    difficulty: "medium"
  },
  {
    question: "What technique involves applying paint thickly to create texture?",
    answers: ["Impasto", "Glazing", "Scumbling", "Grisaille"],
    correct: 0,
    category: "Art",
    difficulty: "medium"
  },
  {
    question: "Who designed the Vietnam Veterans Memorial in Washington D.C.?",
    answers: ["Maya Lin", "Frank Gehry", "I.M. Pei", "Zaha Hadid"],
    correct: 0,
    category: "Art",
    difficulty: "medium"
  },
  {
    question: "Which artist painted 'The Great Wave off Kanagawa'?",
    answers: ["Hiroshige", "Hokusai", "Utamaro", "Kuniyoshi"],
    correct: 1,
    category: "Art",
    difficulty: "medium"
  },
  {
    question: "What is the art movement that Jackson Pollock belonged to?",
    answers: ["Pop Art", "Minimalism", "Abstract Expressionism", "Color Field"],
    correct: 2,
    category: "Art",
    difficulty: "medium"
  },
  {
    question: "Who painted 'Girl with a Pearl Earring'?",
    answers: ["Rembrandt", "Johannes Vermeer", "Jan van Eyck", "Pieter Bruegel"],
    correct: 1,
    category: "Art",
    difficulty: "medium"
  },
  {
    question: "Which museum houses 'The Scream' by Edvard Munch?",
    answers: ["Tate Modern", "MoMA", "National Gallery of Norway", "Pompidou Centre"],
    correct: 2,
    category: "Art",
    difficulty: "medium"
  },

  // Entertainment - Easy
  {
    question: "Which movie features the song 'My Heart Will Go On'?",
    answers: ["The Lion King", "Titanic", "Ghost", "Dirty Dancing"],
    correct: 1,
    category: "Entertainment",
    difficulty: "easy"
  },
  {
    question: "Who directed the movie 'Jaws'?",
    answers: ["George Lucas", "Steven Spielberg", "Francis Ford Coppola", "Martin Scorsese"],
    correct: 1,
    category: "Entertainment",
    difficulty: "easy"
  },
  {
    question: "Which actor played the main character in 'Forrest Gump'?",
    answers: ["Tom Cruise", "Tom Hanks", "Kevin Costner", "Robin Williams"],
    correct: 1,
    category: "Entertainment",
    difficulty: "easy"
  },
  {
    question: "What is the highest-grossing film of all time?",
    answers: ["Titanic", "Avatar", "Avengers: Endgame", "Star Wars: The Force Awakens"],
    correct: 2,
    category: "Entertainment",
    difficulty: "easy"
  },
  {
    question: "Which TV show features the character Walter White?",
    answers: ["Dexter", "The Sopranos", "Breaking Bad", "Better Call Saul"],
    correct: 2,
    category: "Entertainment",
    difficulty: "easy"
  },
  {
    question: "Who composed the music for 'Star Wars'?",
    answers: ["Hans Zimmer", "John Williams", "Danny Elfman", "James Horner"],
    correct: 1,
    category: "Entertainment",
    difficulty: "easy"
  },
  {
    question: "Which Disney movie features the song 'Let It Go'?",
    answers: ["Moana", "Frozen", "Tangled", "Brave"],
    correct: 1,
    category: "Entertainment",
    difficulty: "easy"
  },
  {
    question: "Who played Iron Man in the Marvel Cinematic Universe?",
    answers: ["Chris Evans", "Robert Downey Jr.", "Chris Hemsworth", "Mark Ruffalo"],
    correct: 1,
    category: "Entertainment",
    difficulty: "easy"
  },
  {
    question: "Which streaming platform produced 'Stranger Things'?",
    answers: ["Hulu", "Amazon Prime", "Netflix", "Disney+"],
    correct: 2,
    category: "Entertainment",
    difficulty: "easy"
  },
  {
    question: "What is the name of the coffee shop in 'Friends'?",
    answers: ["Central Perk", "Java Joe's", "Coffee Central", "The Grind"],
    correct: 0,
    category: "Entertainment",
    difficulty: "easy"
  },

  // Entertainment - Medium
  {
    question: "Which movie won the Academy Award for Best Picture in 2020?",
    answers: ["1917", "Joker", "Parasite", "Once Upon a Time in Hollywood"],
    correct: 2,
    category: "Entertainment",
    difficulty: "medium"
  },
  {
    question: "Who directed the movie 'Pulp Fiction'?",
    answers: ["Martin Scorsese", "Quentin Tarantino", "David Lynch", "Joel Coen"],
    correct: 1,
    category: "Entertainment",
    difficulty: "medium"
  },
  {
    question: "Which actor has won the most Academy Awards for acting?",
    answers: ["Jack Nicholson", "Daniel Day-Lewis", "Meryl Streep", "Katharine Hepburn"],
    correct: 3,
    category: "Entertainment",
    difficulty: "medium"
  },
  {
    question: "What was the first Pixar movie?",
    answers: ["A Bug's Life", "Monsters, Inc.", "Toy Story", "Finding Nemo"],
    correct: 2,
    category: "Entertainment",
    difficulty: "medium"
  },
  {
    question: "Which TV series holds the record for most Emmy nominations?",
    answers: ["Game of Thrones", "Saturday Night Live", "The Simpsons", "Frasier"],
    correct: 1,
    category: "Entertainment",
    difficulty: "medium"
  },
  {
    question: "Who created the TV series 'The Twilight Zone'?",
    answers: ["Alfred Hitchcock", "Rod Serling", "Stephen King", "Ray Bradbury"],
    correct: 1,
    category: "Entertainment",
    difficulty: "medium"
  },
  {
    question: "Which movie features the quote 'Here's looking at you, kid'?",
    answers: ["Gone with the Wind", "Casablanca", "The Maltese Falcon", "Citizen Kane"],
    correct: 1,
    category: "Entertainment",
    difficulty: "medium"
  },
  {
    question: "Who composed the score for 'The Lord of the Rings' trilogy?",
    answers: ["John Williams", "Hans Zimmer", "Howard Shore", "James Newton Howard"],
    correct: 2,
    category: "Entertainment",
    difficulty: "medium"
  },
  {
    question: "Which actress played Katniss Everdeen in 'The Hunger Games'?",
    answers: ["Emma Stone", "Jennifer Lawrence", "Shailene Woodley", "Kristen Stewart"],
    correct: 1,
    category: "Entertainment",
    difficulty: "medium"
  },
  {
    question: "What is the name of the fictional paper company in 'The Office'?",
    answers: ["Dunder Mifflin", "Schrute Farms", "Vance Refrigeration", "Michael Scott Paper Company"],
    correct: 0,
    category: "Entertainment",
    difficulty: "medium"
  },

  // Technology - Easy
  {
    question: "What does 'WWW' stand for?",
    answers: ["World Wide Web", "World Wide Wire", "Web World Wide", "Wide World Web"],
    correct: 0,
    category: "Technology",
    difficulty: "easy"
  },
  {
    question: "Which company created the iPhone?",
    answers: ["Samsung", "Google", "Apple", "Microsoft"],
    correct: 2,
    category: "Technology",
    difficulty: "easy"
  },
  {
    question: "What does 'USB' stand for?",
    answers: ["Universal Serial Bus", "Universal System Bus", "United Serial Bus", "Universal Service Bus"],
    correct: 0,
    category: "Technology",
    difficulty: "easy"
  },
  {
    question: "Which social media platform is known for its character limit?",
    answers: ["Facebook", "Instagram", "Twitter", "LinkedIn"],
    correct: 2,
    category: "Technology",
    difficulty: "easy"
  },
  {
    question: "What does 'CPU' stand for?",
    answers: ["Central Processing Unit", "Computer Processing Unit", "Central Program Unit", "Computer Program Unit"],
    correct: 0,
    category: "Technology",
    difficulty: "easy"
  },
  {
    question: "Which company developed the Windows operating system?",
    answers: ["Apple", "Google", "Microsoft", "IBM"],
    correct: 2,
    category: "Technology",
    difficulty: "easy"
  },
  {
    question: "What is the most popular search engine?",
    answers: ["Bing", "Yahoo", "Google", "DuckDuckGo"],
    correct: 2,
    category: "Technology",
    difficulty: "easy"
  },
  {
    question: "Which device is used to input text into a computer?",
    answers: ["Mouse", "Monitor", "Keyboard", "Speaker"],
    correct: 2,
    category: "Technology",
    difficulty: "easy"
  },
  {
    question: "What does 'Wi-Fi' stand for?",
    answers: ["Wireless Fidelity", "Wireless Frequency", "Wide Fidelity", "Wireless Function"],
    correct: 0,
    category: "Technology",
    difficulty: "easy"
  },
  {
    question: "Which company owns YouTube?",
    answers: ["Facebook", "Microsoft", "Google", "Amazon"],
    correct: 2,
    category: "Technology",
    difficulty: "easy"
  },

  // Technology - Medium
  {
    question: "Who founded Microsoft?",
    answers: ["Steve Jobs", "Bill Gates", "Mark Zuckerberg", "Larry Page"],
    correct: 1,
    category: "Technology",
    difficulty: "medium"
  },
  {
    question: "What programming language was created by Guido van Rossum?",
    answers: ["Java", "Python", "C++", "JavaScript"],
    correct: 1,
    category: "Technology",
    difficulty: "medium"
  },
  {
    question: "Which company developed the first personal computer?",
    answers: ["Apple", "IBM", "Microsoft", "Intel"],
    correct: 1,
    category: "Technology",
    difficulty: "medium"
  },
  {
    question: "What does 'GPU' stand for?",
    answers: ["General Processing Unit", "Graphics Processing Unit", "Global Processing Unit", "Game Processing Unit"],
    correct: 1,
    category: "Technology",
    difficulty: "medium"
  },
  {
    question: "Which protocol is used to transfer web pages?",
    answers: ["FTP", "SMTP", "HTTP", "TCP"],
    correct: 2,
    category: "Technology",
    difficulty: "medium"
  },
  {
    question: "What does 'SQL' stand for?",
    answers: ["Standard Query Language", "Structured Query Language", "Simple Query Language", "System Query Language"],
    correct: 1,
    category: "Technology",
    difficulty: "medium"
  },
  {
    question: "Which company created the Android operating system?",
    answers: ["Apple", "Microsoft", "Google", "Samsung"],
    correct: 2,
    category: "Technology",
    difficulty: "medium"
  },
  {
    question: "What is the maximum number of characters in a tweet (as of 2023)?",
    answers: ["140", "280", "320", "500"],
    correct: 1,
    category: "Technology",
    difficulty: "medium"
  },
  {
    question: "Which technology company was founded in a garage by two Steves?",
    answers: ["Microsoft", "Google", "Apple", "Facebook"],
    correct: 2,
    category: "Technology",
    difficulty: "medium"
  },
  {
    question: "What does 'AI' stand for?",
    answers: ["Automated Intelligence", "Artificial Intelligence", "Advanced Intelligence", "Algorithmic Intelligence"],
    correct: 1,
    category: "Technology",
    difficulty: "medium"
  },

  // Nature - Easy
  {
    question: "What is the largest mammal in the world?",
    answers: ["African Elephant", "Blue Whale", "Giraffe", "Hippopotamus"],
    correct: 1,
    category: "Nature",
    difficulty: "easy"
  },
  {
    question: "Which gas do plants absorb from the atmosphere?",
    answers: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"],
    correct: 2,
    category: "Nature",
    difficulty: "easy"
  },
  {
    question: "How many legs does a spider have?",
    answers: ["6", "8", "10", "12"],
    correct: 1,
    category: "Nature",
    difficulty: "easy"
  },
  {
    question: "What is the tallest type of tree?",
    answers: ["Oak", "Pine", "Redwood", "Birch"],
    correct: 2,
    category: "Nature",
    difficulty: "easy"
  },
  {
    question: "Which animal is known as the 'King of the Jungle'?",
    answers: ["Tiger", "Elephant", "Lion", "Leopard"],
    correct: 2,
    category: "Nature",
    difficulty: "easy"
  },
  {
    question: "What do pandas primarily eat?",
    answers: ["Fish", "Bamboo", "Insects", "Fruits"],
    correct: 1,
    category: "Nature",
    difficulty: "easy"
  },
  {
    question: "Which bird is known for its ability to mimic human speech?",
    answers: ["Crow", "Parrot", "Canary", "Robin"],
    correct: 1,
    category: "Nature",
    difficulty: "easy"
  },
  {
    question: "What is the process by which plants make their food?",
    answers: ["Respiration", "Photosynthesis", "Digestion", "Fermentation"],
    correct: 1,
    category: "Nature",
    difficulty: "easy"
  },
  {
    question: "Which mammal is known to have the most teeth?",
    answers: ["Shark", "Dolphin", "Elephant", "Giant Armadillo"],
    correct: 3,
    category: "Nature",
    difficulty: "easy"
  },
  {
    question: "What is the fastest flying bird?",
    answers: ["Eagle", "Falcon", "Hawk", "Peregrine Falcon"],
    correct: 3,
    category: "Nature",
    difficulty: "easy"
  },

  // Nature - Medium
  {
    question: "Which animal has the longest migration route?",
    answers: ["Monarch Butterfly", "Arctic Tern", "Gray Whale", "Caribou"],
    correct: 1,
    category: "Nature",
    difficulty: "medium"
  },
  {
    question: "What is the study of birds called?",
    answers: ["Entomology", "Herpetology", "Ornithology", "Mammalogy"],
    correct: 2,
    category: "Nature",
    difficulty: "medium"
  },
  {
    question: "Which tree produces acorns?",
    answers: ["Maple", "Oak", "Pine", "Birch"],
    correct: 1,
    category: "Nature",
    difficulty: "medium"
  },
  {
    question: "What is the largest species of penguin?",
    answers: ["King Penguin", "Emperor Penguin", "Adelie Penguin", "Chinstrap Penguin"],
    correct: 1,
    category: "Nature",
    difficulty: "medium"
  },
  {
    question: "Which flower is the symbol of remembrance?",
    answers: ["Rose", "Lily", "Poppy", "Sunflower"],
    correct: 2,
    category: "Nature",
    difficulty: "medium"
  },
  {
    question: "What is the collective noun for a group of lions?",
    answers: ["Pack", "Herd", "Pride", "Flock"],
    correct: 2,
    category: "Nature",
    difficulty: "medium"
  },
  {
    question: "Which mammal lays eggs?",
    answers: ["Platypus", "Kangaroo", "Koala", "Wombat"],
    correct: 0,
    category: "Nature",
    difficulty: "medium"
  },
  {
    question: "What is the largest living structure on Earth?",
    answers: ["Amazon Rainforest", "Great Barrier Reef", "Yellowstone National Park", "Sahara Desert"],
    correct: 1,
    category: "Nature",
    difficulty: "medium"
  },
  {
    question: "Which insect is known for its role in pollination?",
    answers: ["Mosquito", "Fly", "Bee", "Ant"],
    correct: 2,
    category: "Nature",
    difficulty: "medium"
  },
  {
    question: "What is the gestation period of an elephant?",
    answers: ["12 months", "18 months", "22 months", "24 months"],
    correct: 2,
    category: "Nature",
    difficulty: "medium"
  },

  // Hard Questions - Various Categories
  {
    question: "What is the speed of light in vacuum?",
    answers: ["299,792,458 m/s", "300,000,000 m/s", "299,000,000 m/s", "301,000,000 m/s"],
    correct: 0,
    category: "Physics",
    difficulty: "hard"
  },
  {
    question: "Which mathematical constant is approximately equal to 2.718?",
    answers: ["Pi", "Phi", "e", "Golden Ratio"],
    correct: 2,
    category: "Mathematics",
    difficulty: "hard"
  },
  {
    question: "Who developed the theory of quantum mechanics?",
    answers: ["Einstein", "Bohr", "Heisenberg", "All of the above"],
    correct: 3,
    category: "Physics",
    difficulty: "hard"
  },
  {
    question: "What is the rarest naturally occurring element on Earth?",
    answers: ["Francium", "Astatine", "Technetium", "Promethium"],
    correct: 1,
    category: "Chemistry",
    difficulty: "hard"
  },
  {
    question: "Which composer wrote 'The Four Seasons'?",
    answers: ["Bach", "Vivaldi", "Mozart", "Beethoven"],
    correct: 1,
    category: "Music",
    difficulty: "hard"
  },
  {
    question: "What is the most abundant protein in the human body?",
    answers: ["Hemoglobin", "Insulin", "Collagen", "Albumin"],
    correct: 2,
    category: "Biology",
    difficulty: "hard"
  },
  {
    question: "Which ancient Greek philosopher tutored Alexander the Great?",
    answers: ["Plato", "Socrates", "Aristotle", "Epicurus"],
    correct: 2,
    category: "History",
    difficulty: "hard"
  },
  {
    question: "What is the deepest part of the world's oceans?",
    answers: ["Mariana Trench", "Puerto Rico Trench", "Java Trench", "Challenger Deep"],
    correct: 3,
    category: "Geography",
    difficulty: "hard"
  },
  {
    question: "Which programming language was developed by James Gosling?",
    answers: ["C++", "Python", "Java", "JavaScript"],
    correct: 2,
    category: "Technology",
    difficulty: "hard"
  },
  {
    question: "What is the study of the origin and history of words called?",
    answers: ["Phonetics", "Semantics", "Etymology", "Morphology"],
    correct: 2,
    category: "Language",
    difficulty: "hard"
  }
];