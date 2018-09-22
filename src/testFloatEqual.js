const testFloatEqual = function(a, b) {
  return (a > b ? a - b : b - a) > 1e-10;
};

export default testFloatEqual;
